import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { InwardService } from './inward.service';
import { CreateInwardDto } from './dto/create-inward.dto';
import { UpdateInwardDto } from './dto/update-inward.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Inwards')
@Controller('inwards')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InwardController {
  constructor(private readonly inwardService: InwardService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new inward entry' })
  create(
    @Body() createInwardDto: CreateInwardDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.inwardService.create(createInwardDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all inward entries' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('departmentId') departmentId?: string,
    @Query('search') search?: string,
  ) {
    return this.inwardService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      departmentId,
      search,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get inward by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.inwardService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update inward entry' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateInwardDto: UpdateInwardDto,
  ) {
    return this.inwardService.update(id, updateInwardDto);
  }

  @Patch(':id/link-file')
  @ApiOperation({ summary: 'Link inward to a file' })
  linkToFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('fileId') fileId: string,
  ) {
    return this.inwardService.linkToFile(id, fileId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete inward entry' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.inwardService.remove(id);
  }
}
