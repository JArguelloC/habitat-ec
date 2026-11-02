import { Module } from '@nestjs/common';
import { FinanzasResenasController } from './finanzas-resenas.controller.js';
import { FinanzasResenasService } from './finanzas-resenas.service.js';
import { PaymentGatewayAdapterService } from './payment-gateway.adapter.js';

@Module({
  controllers: [FinanzasResenasController],
  providers: [FinanzasResenasService, PaymentGatewayAdapterService],
  exports: [FinanzasResenasService, PaymentGatewayAdapterService],
})
export class FinanzasResenasModule {}
