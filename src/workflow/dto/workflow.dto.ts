import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  IsBoolean,
} from 'class-validator';
import { Role } from '@prisma/client';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateStageDto {
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsEnum(Role)
  role: Role;

  @IsInt()
  stageOrder: number;

  @IsBoolean()
  @IsOptional()
  isMandatory?: boolean;
}

export class ApprovalActionDto {
  @IsString()
  @IsNotEmpty()
  status: 'APPROVED' | 'REJECTED' | 'RETURNED';

  @IsString()
  @IsOptional()
  comments?: string;
}
