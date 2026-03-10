import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { ApproveNoteDto } from './dto/approve-note.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { AddMentionsDto } from './dto/add-mentions.dto';

@Injectable()
export class NotesService {
  constructor(private prisma: PrismaService) {}

  async create(createNoteDto: CreateNoteDto, userId: string) {
    const { fileId, content, noteType, parentNoteId, isInternal } =
      createNoteDto;

    // Verify file exists
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Get the latest version for this file and note type
    const latestNote = await this.prisma.note.findFirst({
      where: { fileId, noteType },
      orderBy: { version: 'desc' },
    });

    const version = latestNote ? latestNote.version + 1 : 1;

    return this.prisma.note.create({
      data: {
        content,
        noteType,
        version,
        fileId,
        createdById: userId,
        ...(parentNoteId ? { parentNoteId } : {}),
        ...(typeof isInternal === 'boolean' ? { isInternal } : {}),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        file: {
          select: {
            id: true,
            fileNumber: true,
            subject: true,
          },
        },
      },
    });
  }

  async findByFile(fileId: string) {
    return this.prisma.note.findMany({
      where: { fileId },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [{ noteType: 'asc' }, { version: 'desc' }],
    });
  }

  async findOne(id: string) {
    const note = await this.prisma.note.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        file: {
          select: {
            id: true,
            fileNumber: true,
            subject: true,
          },
        },
      },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    return note;
  }

  async update(id: string, updateNoteDto: UpdateNoteDto, userId: string) {
    const note = await this.findOne(id);

    // Only approved notes cannot be edited
    if (note.noteType === 'APPROVED') {
      throw new ForbiddenException('Approved notes cannot be edited');
    }

    // Only the creator can edit
    if (note.createdById !== userId) {
      throw new ForbiddenException('You can only edit your own notes');
    }

    return this.prisma.note.update({
      where: { id },
      data: updateNoteDto,
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async approve(
    id: string,
    approveNoteDto: ApproveNoteDto,
    approvedById: string,
  ) {
    const note = await this.findOne(id);

    // Only draft notes can be approved
    if (note.noteType !== 'DRAFT') {
      throw new ForbiddenException('Note is already approved');
    }

    // Update the draft note content if provided
    if (approveNoteDto.content) {
      await this.prisma.note.update({
        where: { id },
        data: { content: approveNoteDto.content },
      });
    }

    // Mark as approved
    return this.prisma.note.update({
      where: { id },
      data: {
        noteType: 'APPROVED',
        approvedAt: new Date(),
        approvedById,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async remove(id: string, userId: string) {
    const note = await this.findOne(id);

    // Only the creator can delete
    if (note.createdById !== userId) {
      throw new ForbiddenException('You can only delete your own notes');
    }

    // Only approved notes cannot be deleted
    if (note.noteType === 'APPROVED') {
      throw new ForbiddenException('Approved notes cannot be deleted');
    }

    await this.prisma.note.delete({ where: { id } });
    return { message: 'Note deleted successfully' };
  }

  async reply(parentNoteId: string, dto: CreateReplyDto, userId: string) {
    const parent = await this.findOne(parentNoteId);

    // Versioning per file and note type
    const baseNoteType = dto.noteType || ('COMMENT' as any);
    const latestNote = await this.prisma.note.findFirst({
      where: { fileId: parent.fileId, noteType: baseNoteType },
      orderBy: { version: 'desc' },
    });

    const version = latestNote ? latestNote.version + 1 : 1;

    return this.prisma.note.create({
      data: {
        content: dto.content,
        noteType: baseNoteType,
        version,
        fileId: parent.fileId,
        createdById: userId,
        parentNoteId,
        ...(typeof dto.isInternal === 'boolean'
          ? { isInternal: dto.isInternal }
          : {}),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        file: {
          select: {
            id: true,
            fileNumber: true,
            subject: true,
          },
        },
      },
    });
  }

  async addMentions(noteId: string, dto: AddMentionsDto) {
    await this.findOne(noteId);

    if (!dto.mentions || dto.mentions.length === 0) {
      return { count: 0 };
    }

    const data = dto.mentions.map((m) => ({
      noteId,
      userId: m.userId,
      position: m.position,
    }));

    const result = await (this.prisma as any).noteMention.createMany({
      data,
      skipDuplicates: true,
    });

    return { count: result.count };
  }

  async addAttachment(
    noteId: string,
    file: Express.Multer.File & { buffer: Buffer },
  ) {
    await this.findOne(noteId);

    return (this.prisma as any).noteAttachment.create({
      data: {
        noteId,
        filename: file.filename || `${Date.now()}-${file.originalname}`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        content: file.buffer as any,
      },
    });
  }
}
