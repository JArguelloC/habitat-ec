import {
  Controller,
  Get,
  Post,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

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
}

