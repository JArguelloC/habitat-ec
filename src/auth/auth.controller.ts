import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { Public } from './decorators/public.decorator.js';

export class CreateTokenDto {
  @ApiPropertyOptional({ example: 'user-admin-123', description: 'ID de usuario o sub claim' })
  sub?: string;

  @ApiPropertyOptional({ example: 'alojamientos:read alojamientos:book', description: 'Scopes o permisos concedidos' })
  scope?: string;
}

@ApiTags('Autenticación y Seguridad')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('token')
  @ApiOperation({
    summary: 'Generar token JWT de prueba',
    description: 'Genera un token JWT firmado para pruebas de endpoints protegidos en Swagger, frontend y Postman.',
  })
  @ApiResponse({ status: 201, description: 'Token JWT firmado generado exitosamente' })
  generateToken(@Body() dto?: CreateTokenDto) {
    return this.authService.generateTestToken(dto?.sub, dto?.scope);
  }
}

