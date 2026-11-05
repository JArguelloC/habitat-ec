import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { RegistrarFingerprintDto } from './dto/registrar-fingerprint.dto.js';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto.js';

@Injectable()
export class UsuariosService {
  constructor(private readonly dataSource: DataSource) {}

  async listarUsuarios() {
    const query = `
      SELECT 
        u.usuario_id,
        u.nombre,
        u.apellido,
        u.correo,
        u.telefono,
        u.pais_iso,
        u.activo,
        u.creado_en,
        u.actualizado_en,
        COALESCE(
          json_agg(
            json_build_object('rolId', r.rol_id, 'codigo', r.codigo, 'descripcion', r.descripcion)
          ) FILTER (WHERE r.rol_id IS NOT NULL), 
          '[]'::json
        ) AS roles
      FROM usuarios u
      LEFT JOIN usuario_roles ur ON u.usuario_id = ur.usuario_id
      LEFT JOIN roles r ON ur.rol_id = r.rol_id
      GROUP BY u.usuario_id
      ORDER BY u.creado_en DESC;
    `;
    return this.dataSource.query(query);
  }

  async listarRolesYScopes() {
    const rolesQuery = `
      SELECT 
        r.rol_id,
        r.codigo,
        r.descripcion,
        COALESCE(
          json_agg(
            json_build_object('scopeId', s.scope_id, 'codigoScope', s.codigo_scope, 'descripcion', s.descripcion)
          ) FILTER (WHERE s.scope_id IS NOT NULL),
          '[]'::json
        ) AS scopes
      FROM roles r
      LEFT JOIN rol_scopes rs ON r.rol_id = rs.rol_id
      LEFT JOIN oauth_scopes s ON rs.scope_id = s.scope_id
      GROUP BY r.rol_id
      ORDER BY r.rol_id ASC;
    `;

    const allScopesQuery = `
      SELECT scope_id, codigo_scope, descripcion 
      FROM oauth_scopes 
      ORDER BY scope_id ASC;
    `;

    const [roles, scopes] = await Promise.all([
      this.dataSource.query(rolesQuery),
      this.dataSource.query(allScopesQuery),
    ]);

    return {
      roles,
      catalogoScopes: scopes,
    };
  }

  async registrarOActualizarFingerprint(dto: RegistrarFingerprintDto) {
    const query = `
      INSERT INTO dispositivos_fingerprint (fingerprint_hash, usuario_id, plataforma, bloqueado, ultima_actividad)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (fingerprint_hash) DO UPDATE 
      SET 
        usuario_id = COALESCE(EXCLUDED.usuario_id, dispositivos_fingerprint.usuario_id),
        plataforma = EXCLUDED.plataforma,
        bloqueado = COALESCE(EXCLUDED.bloqueado, dispositivos_fingerprint.bloqueado),
        ultima_actividad = NOW()
      RETURNING *;
    `;

    const result = await this.dataSource.query(query, [
      dto.fingerprintHash,
      dto.usuarioId || null,
      dto.plataforma,
      dto.bloqueado ?? false,
    ]);

    return result[0];
  }

  async obtenerPerfilPropio(usuarioId: string) {
    const rows = await this.dataSource.query(
      `SELECT 
         u.usuario_id AS "usuarioId",
         u.nombre,
         u.apellido,
         u.correo,
         u.telefono,
         u.pais_iso AS "paisIso",
         u.activo,
         u.creado_en AS "creadoEn",
         u.actualizado_en AS "actualizadoEn",
         COALESCE(
           json_agg(r.codigo) FILTER (WHERE r.codigo IS NOT NULL),
           '[]'::json
         ) AS roles
       FROM usuarios u
       LEFT JOIN usuario_roles ur ON u.usuario_id = ur.usuario_id
       LEFT JOIN roles r ON ur.rol_id = r.rol_id
       WHERE u.usuario_id = $1
       GROUP BY u.usuario_id;`,
      [usuarioId],
    );

    if (rows.length === 0) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    return rows[0];
  }

  async actualizarPerfilPropio(usuarioId: string, dto: ActualizarPerfilDto) {
    const userRows = await this.dataSource.query(
      `SELECT usuario_id, nombre, apellido, telefono, pais_iso, password_hash
       FROM usuarios
       WHERE usuario_id = $1`,
      [usuarioId],
    );

    if (userRows.length === 0) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const actual = userRows[0];
    let nuevoPasswordHash = actual.password_hash;

    const claveSolicitada = (dto.passwordNueva || dto.password || '').trim();
    if (claveSolicitada) {
      if (dto.passwordActual) {
        const valida = await bcrypt.compare(
          dto.passwordActual,
          actual.password_hash,
        );
        if (!valida) {
          throw new UnauthorizedException('La contraseña actual es incorrecta.');
        }
      }
      const salt = await bcrypt.genSalt(10);
      nuevoPasswordHash = await bcrypt.hash(claveSolicitada, salt);
    }

    const nombre = dto.nombre !== undefined ? dto.nombre.trim() : actual.nombre;
    const apellido =
      dto.apellido !== undefined ? dto.apellido.trim() : actual.apellido;
    const telefono =
      dto.telefono !== undefined ? dto.telefono.trim() || null : actual.telefono;
    const paisIso =
      dto.paisIso !== undefined
        ? dto.paisIso.toLowerCase()
        : actual.pais_iso || 'ec';

    await this.dataSource.query(
      `UPDATE usuarios
       SET nombre = $1,
           apellido = $2,
           telefono = $3,
           pais_iso = $4,
           password_hash = $5,
           actualizado_en = NOW()
       WHERE usuario_id = $6`,
      [nombre, apellido, telefono, paisIso, nuevoPasswordHash, usuarioId],
    );

    return this.obtenerPerfilPropio(usuarioId);
  }

  async cambiarEstadoUsuario(
    usuarioId: string,
    activo: boolean,
    currentSuperadminId?: string,
  ) {
    if (currentSuperadminId && usuarioId === currentSuperadminId && !activo) {
      throw new BadRequestException(
        'No puedes desactivar tu propia cuenta de Superadministrador.',
      );
    }

    const check = await this.dataSource.query(
      `SELECT usuario_id, nombre, apellido, correo, activo FROM usuarios WHERE usuario_id = $1`,
      [usuarioId],
    );
    if (!check || check.length === 0) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const user = check[0];
    await this.dataSource.query(
      `UPDATE usuarios SET activo = $1, actualizado_en = NOW() WHERE usuario_id = $2`,
      [activo, usuarioId],
    );

    return {
      mensaje: activo
        ? `La cuenta de ${user.nombre} ${user.apellido} ha sido reactivada exitosamente.`
        : `La cuenta de ${user.nombre} ${user.apellido} ha sido dada de baja del sistema.`,
      usuarioId,
      activo,
    };
  }

  async eliminarUsuario(usuarioId: string, currentSuperadminId?: string) {
    if (currentSuperadminId && usuarioId === currentSuperadminId) {
      throw new BadRequestException(
        'No puedes eliminar tu propia cuenta de Superadministrador.',
      );
    }

    const check = await this.dataSource.query(
      `SELECT u.usuario_id, u.nombre, u.apellido, u.correo,
              COALESCE(json_agg(r.codigo) FILTER (WHERE r.codigo IS NOT NULL), '[]'::json) AS roles
       FROM usuarios u
       LEFT JOIN usuario_roles ur ON u.usuario_id = ur.usuario_id
       LEFT JOIN roles r ON ur.rol_id = r.rol_id
       WHERE u.usuario_id = $1
       GROUP BY u.usuario_id;`,
      [usuarioId],
    );

    if (!check || check.length === 0) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const targetUser = check[0];
    const roles: string[] = targetUser.roles || [];
    if (roles.includes('SUPERADMIN')) {
      throw new BadRequestException(
        'No es posible eliminar una cuenta con privilegios de SUPERADMIN.',
      );
    }

    // Verificar si tiene alojamientos asociados como anfitrión propietario
    const alojamientos = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM alojamientos WHERE propietario_id = $1;`,
      [usuarioId],
    );
    if (alojamientos && alojamientos[0] && alojamientos[0].total > 0) {
      throw new BadRequestException(
        `No se puede eliminar de forma definitiva al anfitrión porque tiene ${alojamientos[0].total} alojamiento(s) asociado(s). Puedes darlo de baja del sistema para deshabilitar su acceso sin romper la integridad del inventario.`,
      );
    }

    // Eliminar referencias en usuario_roles
    await this.dataSource.query(
      `DELETE FROM usuario_roles WHERE usuario_id = $1;`,
      [usuarioId],
    );
    // Limpiar dispositivos_fingerprint
    await this.dataSource.query(
      `DELETE FROM dispositivos_fingerprint WHERE usuario_id = $1;`,
      [usuarioId],
    );
    // Eliminar usuario
    await this.dataSource.query(
      `DELETE FROM usuarios WHERE usuario_id = $1;`,
      [usuarioId],
    );

    return {
      mensaje: `La cuenta de ${targetUser.nombre} ${targetUser.apellido} (${targetUser.correo}) ha sido eliminada permanentemente.`,
      usuarioId,
    };
  }
}
