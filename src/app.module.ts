import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AccommodationsModule } from './accommodations/accommodations.module.js';
import { SearchModule } from './search/search.module.js';
import { EventsModule } from './events/events.module.js';
import { OrdenesModule } from './ordenes/ordenes.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { AuthModule } from './auth/auth.module.js';

import { Alojamiento } from './alojamientos/entities/alojamiento.entity.js';
import { Habitacion } from './alojamientos/entities/habitacion.entity.js';
import { CotizacionPrevia } from './ordenes/entities/cotizacion-previa.entity.js';
import { Reserva } from './ordenes/entities/reserva.entity.js';
import { Resena } from './resenas/entities/resena.entity.js';
import { SuscripcionWebhook } from './webhooks/entities/suscripcion-webhook.entity.js';
import { Usuario } from './usuarios/entities/usuario.entity.js';

@Module({
  imports: [
    // Gestión centralizada de variables de entorno
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Persistencia relacional con PostgreSQL y TypeORM
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<string>('NODE_ENV') === 'production';
        const dbUrl = config.get<string>('DATABASE_URL');
        const requiresSsl = isProduction || dbUrl?.includes('neon.tech') || dbUrl?.includes('sslmode=require');

        return {
          type: 'postgres',
          url: dbUrl || 'postgresql://postgres:postgres@localhost:5432/habitat_db',
          entities: [Alojamiento, Habitacion, CotizacionPrevia, Reserva, Resena, SuscripcionWebhook, Usuario],
          // synchronize activo en desarrollo/laboratorio (en producción usar migraciones)
          synchronize: true,
          ssl: requiresSsl
            ? { rejectUnauthorized: false } // Soporte SSL obligatorio para PostgreSQL en Neon / Render
            : false,
          logging: !isProduction,
        };
      },
    }),

    AccommodationsModule,
    SearchModule,
    EventsModule,
    OrdenesModule,
    WebhooksModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
