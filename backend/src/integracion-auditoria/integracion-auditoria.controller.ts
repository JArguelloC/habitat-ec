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
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { IntegracionAuditoriaService } from './integracion-auditoria.service.js';
import { SuscribirWebhookDto } from './dto/suscribir-webhook.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@ApiTags('6. Integración EDA, Webhooks y Auditoría')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class IntegracionAuditoriaController {
  constructor(
    private readonly integracionAuditoriaService: IntegracionAuditoriaService,
  ) {}

  @Post('webhooks/subscribe')
  @Roles('ADMIN', 'SUPERADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      '[ADMIN/SUPERADMIN] Suscribir endpoint para recepción de eventos webhook (webhook_subscriptions y webhook_subscription_events)',
  })
  @ApiResponse({ status: 201, description: 'Suscripción registrada exitosamente' })
  suscribirWebhook(
    @CurrentUser('usuarioId') suscriptorId: string,
    @Body() dto: SuscribirWebhookDto,
  ) {
    return this.integracionAuditoriaService.suscribirWebhook(suscriptorId, dto);
  }

  @Get('webhooks')
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiOperation({
    summary:
      '[ADMIN/SUPERADMIN] Listar suscripciones de webhooks activas y sus eventos configurados',
  })
  @ApiResponse({ status: 200, description: 'Lista de webhooks' })
  listarWebhooks(
    @CurrentUser('usuarioId') usuarioId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.integracionAuditoriaService.listarWebhooks(
      usuarioId,
      roles || [],
    );
  }

  @Get('auditoria/outbox')
  @Roles('SUPERADMIN')
  @ApiOperation({
    summary:
      '[SUPERADMIN] Consultar eventos asíncronos en el Transactional Outbox (outbox_events - EDA)',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: ['PENDIENTE', 'ENVIADO', 'FALLIDO'],
  })
  @ApiQuery({ name: 'limite', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Listado de eventos Outbox' })
  listarOutbox(
    @Query('estado') estado?: string,
    @Query('limite') limite?: string,
  ) {
    const limitNum = limite ? parseInt(limite, 10) : 50;
    return this.integracionAuditoriaService.listarOutbox(estado, limitNum);
  }

  @Get('auditoria/forense')
  @Roles('SUPERADMIN')
  @ApiOperation({
    summary:
      '[SUPERADMIN] Consultar bitácora de auditoría forense de cambios en la base de datos (auditoria_forense)',
  })
  @ApiQuery({ name: 'limite', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Historial de auditoría forense' })
  listarAuditoriaForense(@Query('limite') limite?: string) {
    const limitNum = limite ? parseInt(limite, 10) : 50;
    return this.integracionAuditoriaService.listarAuditoriaForense(limitNum);
  }
}

