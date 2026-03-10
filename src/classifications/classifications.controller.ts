import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClassificationsService } from './classifications.service';
import {
  CreateClassificationDto,
  UpdateClassificationDto,
  SetRoutesDto,
} from './dto/classification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Classifications')
@Controller('classifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ClassificationsController {
  constructor(private readonly service: ClassificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all classifications' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get classification by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create classification (DEPT_HEAD)' })
  create(
    @Body() dto: CreateClassificationDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.create(dto, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update classification name/description' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassificationDto,
  ) {
    return this.service.update(id, dto);
  }

  @Post(':id/routes')
  @ApiOperation({ summary: 'Replace route list for a custom classification' })
  setRoutes(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetRoutesDto) {
    return this.service.setRoutes(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete classification' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
