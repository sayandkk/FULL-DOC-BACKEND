import { IsArray, IsInt, IsUUID, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class NoteMentionItemDto {
  @ApiProperty({ description: 'ID of the user being mentioned' })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Character position of the mention in the note content',
  })
  @IsInt()
  position: number;
}

export class AddMentionsDto {
  @ApiProperty({ type: [NoteMentionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NoteMentionItemDto)
  mentions: NoteMentionItemDto[];
}
