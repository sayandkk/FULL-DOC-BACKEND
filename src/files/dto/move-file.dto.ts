import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';

export enum MovementAction {
  CREATE = 'CREATE',
  FORWARD = 'FORWARD',
  APPROVE = 'APPROVE',
  RETURN = 'RETURN',
  REJECT = 'REJECT',
  CLOSE = 'CLOSE',
  ARCHIVE = 'ARCHIVE',
  RESTORE = 'RESTORE',
  DISPOSE = 'DISPOSE',
}

export class MoveFileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  toUserId?: string;

  @ApiPropertyOptional({
    description:
      'Optional ad-hoc approver to insert before the normal next recipient',
  })
  @IsOptional()
  @IsUUID()
  adhocUserId?: string;

  @ApiProperty({ enum: MovementAction })
  @IsEnum(MovementAction)
  @IsNotEmpty()
  action: MovementAction;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class FileActionDto extends OmitType(MoveFileDto, ['action'] as const) {}

// For approve/reject — toUserId is optional since the action doesn't need a target user,
// but adhocUserId might be provided if a user is inserting an ad-hoc approver during approval.
export class ApproveRejectDto extends FileActionDto {}
