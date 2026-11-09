import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiHeader,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { B2bService } from './b2b.service.js';
import { B2bAuthGuard } from './guards/b2b-auth.guard.js';

@ApiTags('8. Huéspedes Cross-Platform (/api/v2/clientes)')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-API-Key',
  required: false,
  description:
    'API Key de interoperabilidad B2B (hab_b2b_live_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c)',
})
@UseGuards(B2bAuthGuard)
@Controller({ path: 'clientes', version: '2' })
export class B2bClientesController {
  constructor(private readonly b2bService: B2bService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[B2B v2.1] Buscar cliente cross-platform por email o identificacion (cédula/pasaporte)',
  })
  findCliente(
    @Query('email') email?: string,
    @Query('correo') correo?: string,
    @Query('identificacion') identificacion?: string,
    @Query('cedula') cedula?: string,
  ) {
    return this.b2bService.buscarClienteCrossPlatform(
      email || correo,
      identificacion || cedula,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      '[B2B v2.1] Registrar o recuperar cliente cross-platform con rol CLIENTE sin duplicar',
  })
  createOrGetCliente(
    @Body()
    body: {
      nombre?: string;
      email?: string;
      identificacion?: string;
      telefono?: string;
    },
  ) {
    return this.b2bService.registrarClienteCrossPlatform(body || {});
  }
}

