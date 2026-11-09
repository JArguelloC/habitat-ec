import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SoaPaymentsController } from './soa-payments.controller.js';
import { OutboxWorkerService } from './outbox-worker.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        synchronize: false,
        ssl: { rejectUnauthorized: false },
      }),
    }),
  ],
  controllers: [SoaPaymentsController],
  providers: [OutboxWorkerService],
})
export class PaymentsSoaModule {}
