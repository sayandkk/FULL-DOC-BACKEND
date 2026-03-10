import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsArray,
  IsDateString,
  IsInt,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FileStatus } from '@prisma/client';

// Local enums mirroring Prisma schema for validation
export enum PriorityLevelEnum {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
  CRITICAL = 'CRITICAL',
}

export enum FileCategoryEnum {
  FINANCE = 'FINANCE',
  HR = 'HR',
  LEGAL = 'LEGAL',
  OPERATIONS = 'OPERATIONS',
  IT = 'IT',
  PROCUREMENT = 'PROCUREMENT',
  ADMIN = 'ADMIN',
  CUSTOMER_SERVICE = 'CUSTOMER_SERVICE',
  PROJECT = 'PROJECT',
  OTHER = 'OTHER',
}

export enum ConfidentialityLevelEnum {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  RESTRICTED = 'RESTRICTED',
  SECRET = 'SECRET',
}

export class CreateFileDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  classificationId?: string;

  @ApiProperty({ enum: FileStatus, default: FileStatus.PENDING })
  @IsEnum(FileStatus)
  @IsOptional()
  status?: FileStatus;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  departmentId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  inwardId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  workflowCategoryId?: string;

  // --- Enhanced metadata ---
  @ApiPropertyOptional({
    enum: PriorityLevelEnum,
    default: PriorityLevelEnum.NORMAL,
  })
  @IsEnum(PriorityLevelEnum)
  @IsOptional()
  priority?: PriorityLevelEnum;

  @ApiPropertyOptional({
    enum: ConfidentialityLevelEnum,
    default: ConfidentialityLevelEnum.INTERNAL,
  })
  @IsEnum(ConfidentialityLevelEnum)
  @IsOptional()
  confidentiality?: ConfidentialityLevelEnum;

  @ApiPropertyOptional({
    enum: FileCategoryEnum,
    default: FileCategoryEnum.OTHER,
  })
  @IsEnum(FileCategoryEnum)
  @IsOptional()
  category?: FileCategoryEnum;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Due date for SLA' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'SLA in hours' })
  @IsInt()
  @IsOptional()
  slaHours?: number;

  // --- Master Files ---
  @ApiPropertyOptional({
    description: 'Indicates if this file is a master file',
  })
  @IsBoolean()
  @IsOptional()
  isMaster?: boolean;

  @ApiPropertyOptional({
    description: 'List of child file IDs to attach to this master file',
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  childFileIds?: string[];
}
