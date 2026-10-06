import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usuarioRepo.findOne({ where: { correo: registerDto.correo } });
    if (existingUser) {
      throw new ConflictException('El correo ya se encuentra registrado');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const usuario = this.usuarioRepo.create({
      ...registerDto,
      password: hashedPassword,
    });

    const savedUser = await this.usuarioRepo.save(usuario);
    const { password, ...result } = savedUser;
    return result;
  }

  async login(loginDto: LoginDto) {
    const usuario = await this.usuarioRepo.findOne({ where: { correo: loginDto.correo } });
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, usuario.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const payload = {
      sub: usuario.id,
      email: usuario.correo,
      rol: usuario.rol,
      nombre: usuario.nombre,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: usuario.id,
        correo: usuario.correo,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        rol: usuario.rol,
      },
    };
  }

  // Se mantiene para compatibilidad anterior temporal
  generateTestToken(sub = 'user-admin-123', scope = 'alojamientos:read alojamientos:book') {
    const payload = {
      sub,
      scope,
      scopes: scope.split(' '),
      email: 'admin@habitat.ec',
    };

    return {
      access_token: this.jwtService.sign(payload),
      token_type: 'Bearer',
      expires_in: 3600,
      scope,
      user: {
        id: sub,
        scope,
      },
    };
  }
}
