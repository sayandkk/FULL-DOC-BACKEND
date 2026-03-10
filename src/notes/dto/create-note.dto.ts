import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NoteType } from '@prisma/client';

export class CreateNoteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ enum: NoteType, default: NoteType.DRAFT })
  @IsEnum(NoteType)
  @IsNotEmpty()
  noteType: NoteType;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  fileId: string;

  @ApiPropertyOptional({ description: 'Parent note ID for threaded replies' })
  @IsUUID()
  @IsOptional()
  parentNoteId?: string;

  @ApiPropertyOptional({
    description: 'Whether this note is internal/hidden from external users',
  })
  @IsBoolean()
  @IsOptional()
  isInternal?: boolean;
}
