import { PartialType } from '@nestjs/swagger';
import { CreateAccommodationDto } from './create-accommodation.dto.js';

export class UpdateAccommodationDto extends PartialType(CreateAccommodationDto) {}

