import { IsEnum, IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NoteType } from '@prisma/client';

export class CreateReplyDto {
  @ApiProperty()
  @IsString()
  content: string;

  @ApiPropertyOptional({ enum: NoteType })
  @IsEnum(NoteType)
  @IsOptional()
  noteType?: NoteType;

  @ApiPropertyOptional({ description: 'Whether this reply is internal' })
  @IsBoolean()
  @IsOptional()
  isInternal?: boolean;
}
