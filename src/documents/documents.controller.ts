import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  Res,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Documents')
@Controller('documents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a document (stored as BLOB in PostgreSQL)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        fileId: {
          type: 'string',
        },
        inwardId: {
          type: 'string',
        },
        description: {
          type: 'string',
        },
        heading: {
          type: 'string',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
    @Query('fileId') fileId?: string,
    @Query('inwardId') inwardId?: string,
    @Query('description') description?: string,
    @Query('heading') heading?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.documentsService.uploadFile(file, userId, {
      fileId,
      inwardId,
      description,
      heading,
    });
  }

  @Get('file/:fileId')
  @ApiOperation({ summary: 'Get all documents for a file' })
  findByFile(@Param('fileId', ParseUUIDPipe) fileId: string) {
    return this.documentsService.findByFile(fileId);
  }

  @Get('inward/:inwardId')
  @ApiOperation({ summary: 'Get all documents for an inward' })
  findByInward(@Param('inwardId', ParseUUIDPipe) inwardId: string) {
    return this.documentsService.findByInward(inwardId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document metadata by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.findOne(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download document content' })
  async download(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const document = await this.documentsService.download(id);

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${document.originalName}"`,
    );
    res.setHeader('Content-Length', document.size);
    res.send(document.content);
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Preview document (inline)' })
  async preview(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const document = await this.documentsService.download(id);

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${document.originalName}"`,
    );
    res.setHeader('Content-Length', document.size);
    res.send(document.content);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete document' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.remove(id);
  }
}
