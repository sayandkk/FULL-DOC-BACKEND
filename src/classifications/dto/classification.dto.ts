import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsUUID,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClassificationRouteDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  order: number;
}

export class CreateClassificationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: ['NORMAL', 'CUSTOM'], default: 'NORMAL' })
  @IsEnum(['NORMAL', 'CUSTOM'])
  @IsOptional()
  type?: 'NORMAL' | 'CUSTOM';

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ type: [ClassificationRouteDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClassificationRouteDto)
  @IsOptional()
  routes?: ClassificationRouteDto[];
}

export class UpdateClassificationDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}

export class SetRoutesDto {
  @ApiProperty({ type: [ClassificationRouteDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClassificationRouteDto)
  routes: ClassificationRouteDto[];
}
