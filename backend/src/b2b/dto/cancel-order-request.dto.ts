import { IsOptional, IsString, MaxLength, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CancelOrderRequestDto {
  @ApiPropertyOptional({
    description: 'Motivo de la cancelación',
    maxLength: 300,
    example: 'Compensación de Saga: rechazo en reserva de vuelo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;

  @ApiPropertyOptional({
    description: 'Actor que solicita la cancelación',
    enum: ['SAGA_ORCHESTRATOR', 'CLIENTE', 'ADMIN', 'HOTEL'],
    default: 'CLIENTE',
  })
  @IsOptional()
  @IsIn(['SAGA_ORCHESTRATOR', 'CLIENTE', 'ADMIN', 'HOTEL'])
  solicitadoPor?: 'SAGA_ORCHESTRATOR' | 'CLIENTE' | 'ADMIN' | 'HOTEL';
}

