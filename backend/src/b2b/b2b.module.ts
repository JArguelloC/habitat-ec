import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { B2bService } from './b2b.service.js';
import { BookingStockSyncService } from './booking-stock-sync.service.js';
import { B2bAuthGuard } from './guards/b2b-auth.guard.js';
import { B2bAlojamientosController } from './b2b-alojamientos.controller.js';
import { B2bOrdersController } from './b2b-orders.controller.js';
import { B2bClientesController } from './b2b-clientes.controller.js';
import { B2bAdminOrdenesController } from './b2b-admin-ordenes.controller.js';

@Global()
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>('JWT_SECRET') || 'habitat-ec-secret-2026',
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  controllers: [
    B2bAlojamientosController,
    B2bOrdersController,
    B2bClientesController,
    B2bAdminOrdenesController,
  ],
  providers: [B2bService, BookingStockSyncService, B2bAuthGuard],
  exports: [B2bService, BookingStockSyncService, B2bAuthGuard],
})
export class B2bModule {}

