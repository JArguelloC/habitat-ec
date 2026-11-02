import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
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
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    const usuario = usuarios[0];

    if (!usuario.activo) {
      throw new UnauthorizedException(
        'Tu cuenta se encuentra inactiva. Contacta al soporte.',
      );
    }

    // 2. Comparar contraseñas con Bcrypt
    const passwordValida = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValida) {
      throw new UnauthorizedException('Credenciales incorrectas.');
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
          nombre,
          apellido,
          correoNormalizado,
          passwordHash,
          telefono || null,
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
        [nombre, apellido, correoNormalizado, passwordHash, telefono || null],
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
