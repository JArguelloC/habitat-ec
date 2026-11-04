import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { CrearAdminDto } from './dto/crear-admin.dto.js';
import { RegistroClienteDto } from './dto/registro-cliente.dto.js';
import { GoogleAuthDto } from './dto/google-auth.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { Roles } from './decorators/roles.decorator.js';

@ApiTags('1. Autenticación y Superadmin')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('auth/login')
  // Blindaje contra ataques de fuerza bruta en contraseñas (máximo 5 intentos por minuto por IP)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión y obtener token JWT' })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('auth/google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Autenticación o registro automático mediante Google OAuth 2.0 (ID Token)',
  })
  @ApiResponse({ status: 200, description: 'Login con Google exitoso' })
  @ApiResponse({ status: 401, description: 'Token de Google inválido' })
  loginWithGoogle(@Body() googleDto: GoogleAuthDto) {
    return this.authService.loginWithGoogle(googleDto.credential);
  }

  @Post('auth/registro-cliente')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar un nuevo usuario cliente / viajero (Público)',
  })
  @ApiResponse({
    status: 201,
    description: 'Cliente registrado exitosamente',
  })
  @ApiResponse({
    status: 409,
    description: 'El correo electrónico ya se encuentra registrado',
  })
  registroCliente(@Body() registroDto: RegistroClienteDto) {
    return this.authService.registroCliente(registroDto);
  }

  @Post('superadmin/crear-admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      '[SUPERADMIN] Registrar una nueva cuenta de Administrador / Anfitrión',
  })
  @ApiResponse({
    status: 201,
    description: 'Administrador registrado con éxito',
  })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado. Requiere rol SUPERADMIN',
  })
  @ApiResponse({ status: 409, description: 'Correo ya registrado' })
  crearAdmin(@Body() crearAdminDto: CrearAdminDto) {
    return this.authService.crearAdmin(crearAdminDto);
  }
}
