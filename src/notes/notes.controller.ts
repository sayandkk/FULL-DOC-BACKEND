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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { ApproveNoteDto } from './dto/approve-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateReplyDto } from './dto/create-reply.dto';
import { AddMentionsDto } from './dto/add-mentions.dto';

@ApiTags('Notes')
@Controller('notes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new note' })
  create(
    @Body() createNoteDto: CreateNoteDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.notesService.create(createNoteDto, userId);
  }

  @Get('file/:fileId')
  @ApiOperation({ summary: 'Get all notes for a file' })
  findByFile(@Param('fileId', ParseUUIDPipe) fileId: string) {
    return this.notesService.findByFile(fileId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get note by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.notesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a draft note' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateNoteDto: UpdateNoteDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.notesService.update(id, updateNoteDto, userId);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a draft note (converts to White Note)' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() approveNoteDto: ApproveNoteDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.notesService.approve(id, approveNoteDto, userId);
  }

  @Post(':id/reply')
  @ApiOperation({ summary: 'Reply to a note (threaded comment)' })
  reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReplyDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.notesService.reply(id, dto, userId);
  }

  @Post(':id/mentions')
  @ApiOperation({ summary: 'Add mentions to a note' })
  addMentions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMentionsDto,
  ) {
    return this.notesService.addMentions(id, dto);
  }

  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Attach a file to a note' })
  addAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File & { buffer: Buffer },
  ) {
    return this.notesService.addAttachment(id, file);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a note (non-approved only)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notesService.remove(id, userId);
  }
}
