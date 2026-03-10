import {
  Controller,
  Post,
  Get,
  Param,
  Body,
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
import { ArchiveService } from './archive.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Archive')
@Controller('archive')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService) {}

  @Post('files/:id/archive')
  @ApiOperation({ summary: 'Archive a file' })
  archiveFile(
    @Param('id', ParseUUIDPipe) fileId: string,
    @CurrentUser('id') userId: string,
    @Body('remarks') remarks?: string,
  ) {
    return this.archiveService.archiveFile(fileId, userId, remarks);
  }

  @Post('files/:id/restore')
  @ApiOperation({ summary: 'Restore a file from archive' })
  restoreFile(
    @Param('id', ParseUUIDPipe) fileId: string,
    @CurrentUser('id') userId: string,
    @Body('remarks') remarks?: string,
  ) {
    return this.archiveService.restoreFile(fileId, userId, remarks);
  }

  @Post('files/:id/dispose')
  @ApiOperation({ summary: 'Dispose a file (permanent)' })
  disposeFile(
    @Param('id', ParseUUIDPipe) fileId: string,
    @CurrentUser('id') userId: string,
    @Body('remarks') remarks?: string,
  ) {
    return this.archiveService.disposeFile(fileId, userId, remarks);
  }

  @Get('files')
  @ApiOperation({ summary: 'Get all archived files' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'departmentId', required: false })
  getArchivedFiles(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.archiveService.getArchivedFiles({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      departmentId,
    });
  }
}
