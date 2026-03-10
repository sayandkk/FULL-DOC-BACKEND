import { PartialType } from '@nestjs/swagger';
import { CreateInwardDto } from './create-inward.dto';

export class UpdateInwardDto extends PartialType(CreateInwardDto) {}
