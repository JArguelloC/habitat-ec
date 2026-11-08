import { ApiProperty } from '@nestjs/swagger';

export class CategoriaDesgloseDto {
  @ApiProperty({ example: 'LIMP', description: 'Código de la categoría de puntuación' })
  codigo: string;

  @ApiProperty({ example: 'Limpieza & Bioseguridad', description: 'Nombre descriptivo de la categoría' })
  nombre: string;

  @ApiProperty({ example: 4.85, description: 'Puntuación promedio de 0 a 5' })
  promedio: number;
}

export class EstadisticasAnfitrionDto {
  @ApiProperty({ example: 3, description: 'Total de alojamientos registrados por el anfitrión' })
  totalAlojamientos: number;

  @ApiProperty({ example: 3, description: 'Alias para total de alojamientos' })
  totalProperties: number;

  @ApiProperty({ example: 8, description: 'Total de unidades habitacionales activas' })
  totalCuartos: number;

  @ApiProperty({ example: 8, description: 'Alias para total de cuartos' })
  totalRoomsCount: number;

  @ApiProperty({ example: 12, description: 'Total de reservas liquidadas o completadas' })
  reservasLiquidadas: number;

  @ApiProperty({ example: 12, description: 'Alias para total de órdenes liquidadas' })
  totalOrders: number;

  @ApiProperty({ example: 1250.0, description: 'Total de ingresos brutos cobrados en USD' })
  ingresosBrutos: number;

  @ApiProperty({ example: 1250.0, description: 'Alias para total bruto' })
  totalBruto: number;

  @ApiProperty({ example: 1062.5, description: 'Total de ingresos netos a liquidar al anfitrión en USD' })
  ingresosNetos: number;

  @ApiProperty({ example: 1062.5, description: 'Alias para total neto' })
  totalNeto: number;

  @ApiProperty({ example: 187.5, description: 'Comisión retenida por la plataforma en USD' })
  comisionPlataforma: number;

  @ApiProperty({ example: 7, description: 'Total de evaluaciones y reseñas recibidas' })
  totalResenas: number;

  @ApiProperty({ example: 7, description: 'Alias para total de reseñas' })
  totalReviews: number;

  @ApiProperty({ example: 4.85, description: 'Promedio general de calificación (0.00 a 5.00)' })
  avgRating: number;

  @ApiProperty({ example: 4.85, description: 'Alias para calificación promedio' })
  calificacionPromedio: number;

  @ApiProperty({ example: 4.9, description: 'Score promedio de Limpieza y Bioseguridad (0.00 a 5.00)' })
  limpiezaScore: number;

  @ApiProperty({ example: 5.0, description: 'Score promedio de Sostenibilidad y Trato Local (0.00 a 5.00)' })
  sostenibilidadScore: number;

  @ApiProperty({
    type: [CategoriaDesgloseDto],
    description: 'Desglose detallado de puntuaciones por cada categoría multicriterio',
  })
  desgloseCategorias: CategoriaDesgloseDto[];
}

