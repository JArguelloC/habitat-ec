import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RegistrarFingerprintDto } from './dto/registrar-fingerprint.dto.js';

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
}

