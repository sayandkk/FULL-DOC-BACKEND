import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InwardType } from '@prisma/client';

export class CreateInwardDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  senderName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  senderAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  senderContact?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: InwardType })
  @IsEnum(InwardType)
  @IsNotEmpty()
  inwardType: InwardType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  referenceDate?: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  departmentId: string;
}
