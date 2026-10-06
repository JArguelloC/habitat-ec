import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail()
  correo: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}

