import {
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  IsEmail,
  IsInt,
} from 'class-validator';

// Local enums mirrored from Prisma schema for validation purposes
export enum RequestTypeEnum {
  IT_SUPPORT = 'IT_SUPPORT',
  PURCHASE_REQUEST = 'PURCHASE_REQUEST',
  HR_REQUEST = 'HR_REQUEST',
  LEAVE_REQUEST = 'LEAVE_REQUEST',
  LEGAL_CASE = 'LEGAL_CASE',
  CUSTOMER_COMPLAINT = 'CUSTOMER_COMPLAINT',
  PROJECT_PROPOSAL = 'PROJECT_PROPOSAL',
  INVOICE_APPROVAL = 'INVOICE_APPROVAL',
  CONTRACT_REVIEW = 'CONTRACT_REVIEW',
  GENERAL_REQUEST = 'GENERAL_REQUEST',
  OTHER = 'OTHER',
}

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

export class CreateRequestDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsEnum(RequestTypeEnum)
  requestType: RequestTypeEnum;

  @IsEnum(PriorityLevelEnum)
  @IsOptional()
  priority?: PriorityLevelEnum;

  @IsEnum(FileCategoryEnum)
  @IsOptional()
  category?: FileCategoryEnum;

  @IsEnum(ConfidentialityLevelEnum)
  @IsOptional()
  confidentiality?: ConfidentialityLevelEnum;

  @IsString()
  requestorName: string;

  @IsEmail()
  @IsOptional()
  requestorEmail?: string;

  @IsString()
  @IsOptional()
  requestorPhone?: string;

  @IsBoolean()
  @IsOptional()
  isInternal?: boolean;

  @IsString()
  @IsOptional()
  assignedToId?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsInt()
  @IsOptional()
  slaHours?: number;
}
