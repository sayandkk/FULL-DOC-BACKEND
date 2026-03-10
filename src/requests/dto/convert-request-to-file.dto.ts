import { IsOptional, IsString } from 'class-validator';

export class ConvertRequestToFileDto {
  @IsString()
  departmentId: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
