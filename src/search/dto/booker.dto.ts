import { IsString, Matches, IsEnum, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PlatformType {
  ANDROID = 'android',
  DESKTOP = 'desktop',
  IOS = 'ios',
  MOBILE = 'mobile',
  TABLET = 'tablet',
}

export enum TravelPurpose {
  BUSINESS = 'business',
  LEISURE = 'leisure',
}

export enum UserGroup {
  AUTHENTICATED = 'authenticated',
}

export class BookerDto {
  @ApiProperty({ description: 'Código ISO 3166-1 alpha-2 del país del comprador', example: 'ec' })
  @IsString()
  @Matches(/^[a-z]{2}$/, { message: 'El país debe tener exactamente 2 letras minúsculas (Ej. ec)' })
  country: string;

  @ApiProperty({ enum: PlatformType, example: PlatformType.DESKTOP })
  @IsEnum(PlatformType)
  platform: PlatformType;

  @ApiPropertyOptional({ pattern: '^[a-z]{2}$', example: 'pi' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}$/)
  state?: string;

  @ApiPropertyOptional({ enum: TravelPurpose })
  @IsOptional()
  @IsEnum(TravelPurpose)
  travel_purpose?: TravelPurpose;

  @ApiPropertyOptional({ enum: UserGroup, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(UserGroup, { each: true })
  user_groups?: UserGroup[];
}