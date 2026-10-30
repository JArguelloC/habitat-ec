import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto.js';
import { CrearAdminDto } from './dto/crear-admin.dto.js';
import { RegistroClienteDto } from './dto/registro-cliente.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
  ) {}

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
        nombre: `${usuario.nombre} ${usuario.apellido}`,
        correo: usuario.correo,
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
          nombre: `${nuevoUsuario.nombre} ${nuevoUsuario.apellido}`,
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
