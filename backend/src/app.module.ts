import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { CatalogosModule } from './catalogos/catalogos.module.js';
import { AlojamientosModule } from './alojamientos/alojamientos.module.js';
import { OrdenesModule } from './ordenes/ordenes.module.js';
import { FinanzasResenasModule } from './finanzas-resenas/finanzas-resenas.module.js';
import { IntegracionAuditoriaModule } from './integracion-auditoria/integracion-auditoria.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('DB_HOST');
        const dbUrl = configService.get<string>('DATABASE_URL');

        return {
          type: 'postgres',
          ...(host
            ? {
                host,
                port: Number(configService.get<number>('DB_PORT', 5432)),
                username: configService.get<string>('DB_USER'),
                password: configService.get<string>('DB_PASSWORD'),
                database: configService.get<string>('DB_NAME'),
              }
            : {
                url: dbUrl,
              }),
          synchronize: false,
          ssl: {
            rejectUnauthorized: false,
          },
          extra: {
            ssl: {
              rejectUnauthorized: false,
            },
            connectionTimeoutMillis: 15000,
            query_timeout: 15000,
            statement_timeout: 15000,
            keepAlive: true,
          },
        };
      },
    }),
    AuthModule,
    UsuariosModule,
    CatalogosModule,
    AlojamientosModule,
    OrdenesModule,
    FinanzasResenasModule,
    IntegracionAuditoriaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
