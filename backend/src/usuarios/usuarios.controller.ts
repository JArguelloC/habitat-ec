import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service.js';
import { RegistrarFingerprintDto } from './dto/registrar-fingerprint.dto.js';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto.js';
import { CambiarEstadoUsuarioDto } from './dto/cambiar-estado-usuario.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@ApiTags('1.1 Gestión de Usuarios e Identidad')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[SUPERADMIN] Listar todos los usuarios y sus roles asignados (4FN)',
  })
  @ApiResponse({ status: 200, description: 'Listado de usuarios' })
  @ApiResponse({ status: 403, description: 'Requiere rol SUPERADMIN' })
  listarUsuarios() {
    return this.usuariosService.listarUsuarios();
  }

  @Get('roles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      '[SUPERADMIN] Listar roles del sistema y scopes OAuth2 asociados (rol_scopes)',
  })
  @ApiResponse({ status: 200, description: 'Listado de roles y scopes' })
  @ApiResponse({ status: 403, description: 'Requiere rol SUPERADMIN' })
  listarRolesYScopes() {
    return this.usuariosService.listarRolesYScopes();
  }

  @Post('fingerprints')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Registrar o actualizar la última actividad de un dispositivo cliente (dispositivos_fingerprint)',
  })
  @ApiResponse({
    status: 200,
    description: 'Dispositivo registrado o actualizado exitosamente',
  })
  registrarFingerprint(@Body() dto: RegistrarFingerprintDto) {
    return this.usuariosService.registrarOActualizarFingerprint(dto);
  }

  @Get('perfil')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener los datos del perfil del usuario autenticado',
  })
  obtenerPerfil(@CurrentUser('usuarioId') usuarioId: string) {
    return this.usuariosService.obtenerPerfilPropio(usuarioId);
  }

  @Patch('perfil')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Actualizar datos personales o contraseña del usuario autenticado',
  })
  actualizarPerfil(
    @CurrentUser('usuarioId') usuarioId: string,
    @Body() dto: ActualizarPerfilDto,
  ) {
    return this.usuariosService.actualizarPerfilPropio(usuarioId, dto);
  }

  @Patch(':id/estado')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[SUPERADMIN] Cambiar estado de un usuario (Dar de baja o reactivar)',
  })
  @ApiResponse({ status: 200, description: 'Estado del usuario actualizado' })
  cambiarEstado(
    @Param('id') id: string,
    @Body() dto: CambiarEstadoUsuarioDto,
    @CurrentUser('usuarioId') currentSuperadminId: string,
  ) {
    return this.usuariosService.cambiarEstadoUsuario(
      id,
      dto.activo,
      currentSuperadminId,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[SUPERADMIN] Eliminar permanentemente un usuario',
  })
  @ApiResponse({ status: 200, description: 'Usuario eliminado permanentemente' })
  @ApiResponse({ status: 400, description: 'No se puede eliminar por reglas de seguridad' })
  eliminarUsuario(
    @Param('id') id: string,
    @CurrentUser('usuarioId') currentSuperadminId: string,
  ) {
    return this.usuariosService.eliminarUsuario(id, currentSuperadminId);
  }
}

