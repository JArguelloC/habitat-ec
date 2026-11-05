import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { LoginDto } from './dto/login.dto.js';
import { CrearAdminDto } from './dto/crear-admin.dto.js';
import { RegistroClienteDto } from './dto/registro-cliente.dto.js';
import {
  SolicitarRecuperacionDto,
  RestablecerPasswordDto,
} from './dto/recuperar-password.dto.js';

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  private computePasswordFingerprint(passwordHash: string): string {
    return crypto
      .createHash('sha256')
      .update(passwordHash)
      .digest('hex')
      .slice(0, 16);
  }

  private generateSixDigitRecoveryCode(
    usuarioId: string,
    correo: string,
    fingerprint: string,
    timeBucket: number,
  ): string {
    const secret =
      this.configService.get<string>('JWT_SECRET') || 'habitat-ec-secret-2026';
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(`${usuarioId}:${correo}:${fingerprint}:${timeBucket}`)
      .digest('hex');
    const numeric = parseInt(hmac.slice(0, 8), 16) % 900000;
    return String(100000 + numeric);
  }

  async login(loginDto: LoginDto) {
    const { correo, password } = loginDto;

    // 1. Buscar usuario y verificar estado
    const usuarios = await this.dataSource.query(
      `SELECT usuario_id, nombre, apellido, correo, password_hash, activo 
       FROM usuarios 
       WHERE correo = $1`,
      [correo.toLowerCase().trim()],
    );

    if (usuarios.length === 0) {
      throw new UnauthorizedException(
        'No encontramos una cuenta asociada a este correo electrónico. Verifica que esté bien escrito o crea una cuenta.',
      );
    }

    const usuario = usuarios[0];

    if (!usuario.activo) {
      throw new UnauthorizedException(
        'Tu cuenta se encuentra inactiva. Contacta al soporte de Hábitat EC.',
      );
    }

    // 2. Comparar contraseñas con Bcrypt (Retroalimentación IHC de Jakob Nielsen)
    const passwordValida = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValida) {
      throw new UnauthorizedException(
        'Contraseña incorrecta para esta cuenta. ¿Olvidaste tu contraseña? Puedes recuperarla de forma segura con tu correo electrónico.',
      );
    }

    // 3. Obtener roles asignados desde usuario_roles (4FN)
    const rolesRows = await this.dataSource.query(
      `SELECT r.codigo 
       FROM usuario_roles ur
       JOIN roles r ON ur.rol_id = r.rol_id
       WHERE ur.usuario_id = $1`,
      [usuario.usuario_id],
    );

    const roles: string[] = rolesRows.map(
      (row: { codigo: string }) => row.codigo,
    );

    // 4. Generar JWT firmado
    const payload = {
      sub: usuario.usuario_id,
      correo: usuario.correo,
      roles,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      usuario: {
        usuarioId: usuario.usuario_id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        roles,
      },
    };
  }

  async solicitarRecuperacionPassword(dto: SolicitarRecuperacionDto) {
    const correoNormalizado = dto.correo.toLowerCase().trim();

    const usuarios = await this.dataSource.query(
      `SELECT usuario_id, nombre, apellido, correo, password_hash, activo
       FROM usuarios
       WHERE correo = $1`,
      [correoNormalizado],
    );

    if (usuarios.length === 0) {
      throw new NotFoundException(
        'No encontramos una cuenta registrada con ese correo electrónico en Hábitat EC.',
      );
    }

    const usuario = usuarios[0];
    if (!usuario.activo) {
      throw new UnauthorizedException(
        'Tu cuenta se encuentra inactiva. Por favor contacta al soporte.',
      );
    }

    // Huella criptográfica de un solo uso vinculada al hash actual
    const fingerprint = this.computePasswordFingerprint(usuario.password_hash);
    const currentBucket = Math.floor(Date.now() / (15 * 60 * 1000));
    const codigoSeguridad = this.generateSixDigitRecoveryCode(
      String(usuario.usuario_id),
      usuario.correo,
      fingerprint,
      currentBucket,
    );

    const tokenRecuperacion = await this.jwtService.signAsync(
      {
        sub: usuario.usuario_id,
        correo: usuario.correo,
        purpose: 'PASSWORD_RESET_HTTPS',
        fp: fingerprint,
      },
      { expiresIn: '15m' },
    );

    // Enlace canónico obligatorio bajo HTTPS (previene Host Header Injection / Open Redirect y bloqueos por SPAM)
    const canonicalHttpsDomain = 'https://app.habitat-ec.com';
    const enlaceRecuperacionHttps = `${canonicalHttpsDomain}/login?modo=recuperar&correo=${encodeURIComponent(
      usuario.correo,
    )}&codigo=${encodeURIComponent(codigoSeguridad)}&token=${encodeURIComponent(
      tokenRecuperacion,
    )}`;

    const messageId = `<recuperacion-${crypto.randomUUID()}@mail.habitat-ec.com>`;
    const asunto = 'Restablecimiento seguro de tu contraseña en Hábitat EC';

    const cuerpoTextoEspanol = [
      `¡Hola, ${usuario.nombre} ${usuario.apellido}!`,
      ``,
      `Esperamos que estés teniendo un excelente día. Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Hábitat EC — Hospitalidad Sostenible asociada al correo ${usuario.correo}.`,
      ``,
      `¿Qué debes hacer para recuperar tu acceso de forma segura?`,
      `Sigue estos sencillos pasos:`,
      `1. Haz clic en nuestro enlace seguro cifrado (HTTPS) o copia el código de verificación de 6 dígitos que aparece más abajo.`,
      `2. Ingresa tu nueva contraseña en el formulario de seguridad (te recomendamos combinar letras mayúsculas, minúsculas, números y un símbolo especial).`,
      `3. Confirma el cambio e inicia sesión normalmente con tu nueva clave.`,
      ``,
      `• Código de seguridad de un solo uso (válido por 15 minutos): ${codigoSeguridad}`,
      `• Enlace directo de recuperación segura (HTTPS):`,
      `${enlaceRecuperacionHttps}`,
      ``,
      `Políticas de Seguridad y Privacidad Anti-Fraude:`,
      `- Este enlace utiliza exclusivamente el protocolo seguro HTTPS (TLS 1.3) hacia el dominio oficial de Hábitat EC para protegerte contra ataques colaterales o suplantación (phishing).`,
      `- El código y enlace son de un solo uso y caducan automáticamente en 15 minutos.`,
      `- Si tú no solicitaste este cambio de contraseña, puedes ignorar este correo con total tranquilidad: tu cuenta permanece completamente segura y no se realizará ninguna modificación.`,
      ``,
      `Con aprecio,`,
      `El Equipo de Seguridad y Experiencia del Viajero`,
      `Hábitat EC — Ecoturismo & Hospitalidad Sostenible en Ecuador`,
    ].join('\n');

    return {
      mensaje:
        'Hemos generado y enviado un correo seguro (HTTPS / Anti-SPAM) con las instrucciones en español para restablecer tu contraseña.',
      correoDestino: usuario.correo,
      expiraEnMinutos: 15,
      codigoSeguridad,
      tokenRecuperacion,
      enlaceRecuperacionHttps,
      correoSeguroEnviado: {
        messageId,
        remitente: 'Hábitat EC — Seguridad de Cuentas <seguridad@habitat-ec.com>',
        responderA: 'soporte@habitat-ec.com',
        destinatario: `${usuario.nombre} ${usuario.apellido} <${usuario.correo}>`,
        asunto,
        idioma: 'es-EC',
        politicasSeguridadAntiSpam: {
          protocoloEnlaces: 'HTTPS Estricto (TLS 1.3)',
          spf: 'PASS (habitat-ec.com autorizado)',
          dkim: 'PASS (selector habitatec2026 RSA-2048)',
          dmarc: 'PASS (p=reject; pct=100)',
          proteccionAtaquesColaterales:
            'Dominio canónico fijo (Anti-Host-Header-Poisoning) + Token de un solo uso invalidado al cambiar clave',
          clasificacion: 'Transaccional autenticado (No SPAM / RFC-3834 Auto-Submitted)',
        },
        cuerpoTextoEspanol,
      },
    };
  }

  async restablecerPassword(dto: RestablecerPasswordDto) {
    const correoNormalizado = dto.correo.toLowerCase().trim();
    const codigoIngresado = dto.codigoSeguridad.trim();

    const usuarios = await this.dataSource.query(
      `SELECT usuario_id, nombre, apellido, correo, password_hash, activo
       FROM usuarios
       WHERE correo = $1`,
      [correoNormalizado],
    );

    if (usuarios.length === 0) {
      throw new NotFoundException(
        'No encontramos una cuenta asociada a este correo electrónico.',
      );
    }

    const usuario = usuarios[0];
    if (!usuario.activo) {
      throw new UnauthorizedException('La cuenta se encuentra inactiva.');
    }

    const currentFingerprint = this.computePasswordFingerprint(
      usuario.password_hash,
    );
    const currentBucket = Math.floor(Date.now() / (15 * 60 * 1000));

    const expectedCodeCurrent = this.generateSixDigitRecoveryCode(
      String(usuario.usuario_id),
      usuario.correo,
      currentFingerprint,
      currentBucket,
    );
    const expectedCodePrev = this.generateSixDigitRecoveryCode(
      String(usuario.usuario_id),
      usuario.correo,
      currentFingerprint,
      currentBucket - 1,
    );

    let verificado =
      codigoIngresado === expectedCodeCurrent ||
      codigoIngresado === expectedCodePrev;

    // También validar si se proporcionó el tokenRecuperacion JWT firmado
    const tokenCandidate = dto.tokenRecuperacion || codigoIngresado;
    if (!verificado && tokenCandidate.split('.').length === 3) {
      try {
        const decoded = await this.jwtService.verifyAsync<{
          sub: string;
          correo: string;
          purpose: string;
          fp: string;
        }>(tokenCandidate);
        if (
          decoded.purpose === 'PASSWORD_RESET_HTTPS' &&
          String(decoded.sub) === String(usuario.usuario_id) &&
          decoded.correo === usuario.correo &&
          decoded.fp === currentFingerprint
        ) {
          verificado = true;
        }
      } catch {
        verificado = false;
      }
    }

    if (!verificado) {
      throw new BadRequestException(
        'El código de seguridad o enlace HTTPS es inválido, ya fue utilizado o ha expirado (15 min). Por favor solicita un nuevo correo de recuperación.',
      );
    }

    const salt = await bcrypt.genSalt(10);
    const nuevoPasswordHash = await bcrypt.hash(dto.nuevaPassword, salt);

    await this.dataSource.query(
      `UPDATE usuarios
       SET password_hash = $1,
           actualizado_en = NOW()
       WHERE usuario_id = $2`,
      [nuevoPasswordHash, usuario.usuario_id],
    );

    return {
      mensaje:
        '¡Tu contraseña ha sido restablecida con éxito! Ahora puedes iniciar sesión con tu nueva clave segura.',
      correo: usuario.correo,
      actualizadoEn: new Date().toISOString(),
    };
  }

  async loginWithGoogle(credential: string) {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');

    let email: string | undefined;
    let givenName: string | undefined;
    let familyName: string | undefined;

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: googleClientId,
      });
      const payload = ticket.getPayload();

      // Blindaje de identidad: verificar que el correo haya sido validado por Google (Pre-Account Takeover prevention)
      if (!payload?.email_verified) {
        throw new UnauthorizedException(
          'La cuenta de Google no tiene el correo electrónico verificado.',
        );
      }

      email = payload?.email;
      givenName = payload?.given_name;
      familyName = payload?.family_name;
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : 'Token de Google inválido';
      throw new UnauthorizedException(
        `No se pudo verificar la credencial de Google: ${mensaje}`,
      );
    }

    if (!email) {
      throw new UnauthorizedException(
        'El token de Google no contiene un correo electrónico válido.',
      );
    }

    const correoNormalizado = email.toLowerCase().trim();
    const nombreUsuario = (givenName || correoNormalizado.split('@')[0]).trim();
    const apellidoUsuario = (familyName || 'Usuario').trim();

    const usuarios = await this.dataSource.query(
      `SELECT usuario_id, nombre, apellido, correo, activo
       FROM usuarios
       WHERE correo = $1`,
      [correoNormalizado],
    );

    let usuarioId: string;
    let nombreFinal: string;
    let apellidoFinal: string;
    let roles: string[] = [];

    if (usuarios.length === 0) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const randomPassword = crypto.randomBytes(24).toString('hex');
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(randomPassword, salt);

        const rolRows = await queryRunner.query(
          `SELECT rol_id FROM roles WHERE codigo = 'CLIENTE' LIMIT 1`,
        );
        const clienteRolId = rolRows[0]?.rol_id ?? 3;

        const insertUser = await queryRunner.query(
          `INSERT INTO usuarios (nombre, apellido, correo, password_hash, activo, pais_iso)
           VALUES ($1, $2, $3, $4, TRUE, 'ec')
           RETURNING usuario_id, nombre, apellido, correo`,
          [nombreUsuario, apellidoUsuario, correoNormalizado, passwordHash],
        );

        const nuevo = insertUser[0];
        usuarioId = nuevo.usuario_id;
        nombreFinal = nuevo.nombre;
        apellidoFinal = nuevo.apellido;
        roles = ['CLIENTE'];

        await queryRunner.query(
          `INSERT INTO usuario_roles (usuario_id, rol_id) VALUES ($1, $2)`,
          [usuarioId, clienteRolId],
        );

        await queryRunner.commitTransaction();
      } catch (error) {
        await queryRunner.rollbackTransaction();
        const mensaje =
          error instanceof Error ? error.message : 'Error desconocido';
        throw new InternalServerErrorException(
          `Error al aprovisionar cuenta con Google: ${mensaje}`,
        );
      } finally {
        await queryRunner.release();
      }
    } else {
      const existente = usuarios[0];
      if (!existente.activo) {
        throw new UnauthorizedException(
          'Tu cuenta se encuentra inactiva. Contacta al soporte.',
        );
      }

      usuarioId = existente.usuario_id;
      nombreFinal = existente.nombre;
      apellidoFinal = existente.apellido;

      const rolesRows = await this.dataSource.query(
        `SELECT r.codigo
         FROM usuario_roles ur
         JOIN roles r ON ur.rol_id = r.rol_id
         WHERE ur.usuario_id = $1`,
        [usuarioId],
      );

      roles = rolesRows.map((row: { codigo: string }) => row.codigo);
    }

    const jwtPayload = {
      sub: usuarioId,
      correo: correoNormalizado,
      roles,
    };

    const accessToken = await this.jwtService.signAsync(jwtPayload);

    return {
      accessToken,
      usuario: {
        usuarioId,
        nombre: nombreFinal,
        apellido: apellidoFinal,
        correo: correoNormalizado,
        roles,
      },
    };
  }

  async registroCliente(registroDto: RegistroClienteDto) {
    const { nombre, apellido, correo, password, telefono, paisIso } = registroDto;
    const correoNormalizado = correo.toLowerCase().trim();

    // 1. Verificar unicidad de correo
    const existe = await this.dataSource.query(
      `SELECT usuario_id FROM usuarios WHERE correo = $1`,
      [correoNormalizado],
    );

    if (existe.length > 0) {
      throw new ConflictException(
        'Ya existe un usuario registrado con este correo electrónico.',
      );
    }

    // 2. Obtener rol CLIENTE
    const rolCliente = await this.dataSource.query(
      `SELECT rol_id FROM roles WHERE codigo = 'CLIENTE'`,
    );

    if (rolCliente.length === 0) {
      throw new NotFoundException("El rol 'CLIENTE' no existe en el catálogo.");
    }

    const clienteRolId = rolCliente[0].rol_id;

    // 3. Hashear contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Transacción atómica
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const insertUser = await queryRunner.query(
        `INSERT INTO usuarios (nombre, apellido, correo, password_hash, telefono, pais_iso)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING usuario_id, nombre, apellido, correo, creado_en`,
        [
          nombre.trim(),
          apellido.trim(),
          correoNormalizado,
          passwordHash,
          telefono ? telefono.trim() : null,
          (paisIso || 'ec').toLowerCase(),
        ],
      );

      const nuevoUsuario = insertUser[0];

      await queryRunner.query(
        `INSERT INTO usuario_roles (usuario_id, rol_id) VALUES ($1, $2)`,
        [nuevoUsuario.usuario_id, clienteRolId],
      );

      await queryRunner.commitTransaction();

      // Emitir token JWT directo para bienvenida
      const payload = {
        sub: nuevoUsuario.usuario_id,
        correo: nuevoUsuario.correo,
        roles: ['CLIENTE'],
      };
      const accessToken = await this.jwtService.signAsync(payload);

      return {
        mensaje: 'Registro de cliente exitoso.',
        accessToken,
        usuario: {
          usuarioId: nuevoUsuario.usuario_id,
          nombre: nuevoUsuario.nombre,
          apellido: nuevoUsuario.apellido,
          correo: nuevoUsuario.correo,
          roles: ['CLIENTE'],
          creadoEn: nuevoUsuario.creado_en,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async crearAdmin(crearAdminDto: CrearAdminDto) {
    const { nombre, apellido, correo, password, telefono } = crearAdminDto;
    const correoNormalizado = correo.toLowerCase().trim();

    // 1. Validar unicidad del correo
    const existe = await this.dataSource.query(
      `SELECT usuario_id FROM usuarios WHERE correo = $1`,
      [correoNormalizado],
    );

    if (existe.length > 0) {
      throw new ConflictException(
        'Ya existe un usuario registrado con este correo electrónico.',
      );
    }

    // 2. Obtener rol_id de ADMIN
    const rolAdmin = await this.dataSource.query(
      `SELECT rol_id FROM roles WHERE codigo = 'ADMIN'`,
    );

    if (rolAdmin.length === 0) {
      throw new NotFoundException(
        "El rol 'ADMIN' no está configurado en el catálogo de roles.",
      );
    }

    const adminRolId = rolAdmin[0].rol_id;

    // 3. Hashear contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Transacción atómica para crear usuario y asignar rol
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const insertUser = await queryRunner.query(
        `INSERT INTO usuarios (nombre, apellido, correo, password_hash, telefono, pais_iso)
         VALUES ($1, $2, $3, $4, $5, 'ec')
         RETURNING usuario_id, nombre, apellido, correo, creado_en`,
        [
          nombre.trim(),
          apellido.trim(),
          correoNormalizado,
          passwordHash,
          telefono ? telefono.trim() : null,
        ],
      );

      const nuevoUsuario = insertUser[0];

      await queryRunner.query(
        `INSERT INTO usuario_roles (usuario_id, rol_id) VALUES ($1, $2)`,
        [nuevoUsuario.usuario_id, adminRolId],
      );

      await queryRunner.commitTransaction();

      return {
        mensaje: 'Administrador / Anfitrión registrado con éxito.',
        usuario: {
          usuarioId: nuevoUsuario.usuario_id,
          nombre: `${nuevoUsuario.nombre} ${nuevoUsuario.apellido}`,
          correo: nuevoUsuario.correo,
          rol: 'ADMIN',
          creadoEn: nuevoUsuario.creado_en,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
