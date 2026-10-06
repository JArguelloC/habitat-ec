import {
  Controller,
  Post,
  Body,
  Headers,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { SearchService } from './search.service.js';
import { SearchAccommodationRequestDto } from './dto/search-accommodation-request.dto.js';
import { SearchAccommodationResponseDto } from './dto/search-accommodation-response.dto.js';

@ApiTags('Búsqueda y Catálogo')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Búsqueda de alojamientos según contrato OpenAPI' })
  @ApiHeader({
    name: 'X-Device-Fingerprint',
    required: true,
    description: 'Identificador único del dispositivo del cliente (prevención de fraude)',
  })
  @ApiResponse({
    status: 200,
    description: 'Alojamientos encontrados',
    type: SearchAccommodationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Cuerpo de solicitud o encabezados inválidos' })
  @Header('Cache-Control', 'public, max-age=300')
  async search(
    @Headers('x-device-fingerprint') fingerprint: string,
    @Body() body: SearchAccommodationRequestDto,
  ): Promise<SearchAccommodationResponseDto> {
    if (!fingerprint || fingerprint.trim().length === 0) {
      throw new BadRequestException('El encabezado X-Device-Fingerprint es obligatorio');
    }

    return await this.searchService.search(body);
  }
}

