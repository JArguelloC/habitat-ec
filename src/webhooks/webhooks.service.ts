import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SuscripcionWebhook } from './entities/suscripcion-webhook.entity.js';
import { CreateWebhookDto } from './dto/webhooks.dto.js';

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(SuscripcionWebhook)
    private readonly webhookRepo: Repository<SuscripcionWebhook>,
  ) {}

  async findAll() {
    return await this.webhookRepo.find({ where: { activo: true } });
  }

  async create(dto: CreateWebhookDto) {
    const sub = this.webhookRepo.create({
      urlDestino: dto.url,
      eventos: dto.events,
      secreto: dto.secret,
      activo: true,
    });
    return await this.webhookRepo.save(sub);
  }

  async remove(id: string) {
    const result = await this.webhookRepo.delete(id);
    if (!result.affected) throw new NotFoundException('Suscripción no encontrada');
  }
}

