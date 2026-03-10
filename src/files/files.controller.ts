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
import { FilesService } from './files.service';
import { CreateFileDto } from './dto/create-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import {
  MoveFileDto,
  FileActionDto,
  ApproveRejectDto,
} from './dto/move-file.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Files')
@Controller('files')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new file' })
  create(
    @Body() createFileDto: CreateFileDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.filesService.create(createFileDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all files' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'confidentiality', required: false })
  @ApiQuery({ name: 'isMaster', required: false, type: Boolean })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('departmentId') departmentId?: string,
    @Query('search') search?: string,
    @Query('priority') priority?: string,
    @Query('category') category?: string,
    @Query('confidentiality') confidentiality?: string,
    @Query('isMaster') isMaster?: string,
    @CurrentUser() user?: any,
  ) {
    return this.filesService.findAll(
      {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
        status,
        // If user is ADMIN, trust the query param. If not, service will override/enforce it.
        departmentId,
        search,
        priority,
        category,
        confidentiality,
        isMaster: isMaster ? isMaster === 'true' : undefined,
      },
      user,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get file by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.filesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update file' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateFileDto: UpdateFileDto,
  ) {
    return this.filesService.update(id, updateFileDto);
  }

  @Post(':id/move')
  @ApiOperation({ summary: 'Move/Forward file to another user' })
  moveFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() moveFileDto: MoveFileDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.filesService.moveFile(id, moveFileDto, userId);
  }

  @Post(':id/forward')
  @ApiOperation({ summary: 'Forward file' })
  forward(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FileActionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.filesService.moveFile(
      id,
      { ...dto, action: 'FORWARD' } as any,
      userId,
    );
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve file' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveRejectDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.filesService.moveFile(
      id,
      { ...dto, action: 'APPROVE' } as any,
      userId,
    );
  }

  @Post(':id/return')
  @ApiOperation({ summary: 'Return file' })
  returnFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FileActionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.filesService.moveFile(
      id,
      { ...dto, action: 'RETURN' } as any,
      userId,
    );
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject file' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveRejectDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.filesService.moveFile(
      id,
      { ...dto, action: 'REJECT' } as any,
      userId,
    );
  }

  @Post(':id/close')
  @ApiOperation({ summary: 'Close file' })
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FileActionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.filesService.moveFile(
      id,
      { ...dto, action: 'CLOSE' } as any,
      userId,
    );
  }

  @Get(':id/movements')
  @ApiOperation({ summary: 'Get file movement history' })
  getMovements(@Param('id', ParseUUIDPipe) id: string) {
    return this.filesService.getMovements(id);
  }

  @Post('sla/evaluate')
  @ApiOperation({
    summary: 'Evaluate SLA and create escalations for overdue files',
  })
  evaluateSla() {
    return this.filesService.evaluateSla();
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete file' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.filesService.remove(id);
  }
}
