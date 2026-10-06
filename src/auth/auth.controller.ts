import { Controller, Post, Body, Get, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { Public } from './decorators/public.decorator.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

export class CreateTokenDto {
  @ApiPropertyOptional({ example: 'user-admin-123', description: 'ID de usuario o sub claim' })
  sub?: string;

  @ApiPropertyOptional({ example: 'alojamientos:read alojamientos:book', description: 'Scopes o permisos concedidos' })
  scope?: string;
}

@ApiTags('Autenticación y Cuentas')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un nuevo usuario (CLIENTE o PROPIETARIO)' })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente' })
  @ApiResponse({ status: 409, description: 'El correo ya se encuentra registrado' })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión y obtener token JWT' })
  @ApiResponse({ status: 200, description: 'Autenticación exitosa' })
  @ApiResponse({ status: 401, description: 'Credenciales incorrectas' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @ApiBearerAuth('JWT-Auth')
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiOperation({ summary: 'Obtener el perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil recuperado exitosamente' })
  getProfile(@Req() req: any) {
    return req.user;
  }

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
