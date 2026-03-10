import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ArchiveService {
  constructor(private prisma: PrismaService) {}

  async archiveFile(fileId: string, userId: string, remarks?: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.status === 'ARCHIVED') {
      throw new BadRequestException('File is already archived');
    }

    // Update file status
    const updatedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
      },
      include: {
        department: true,
        currentOwner: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Log the archive action
    await this.prisma.fileMovement.create({
      data: {
        fileId,
        fromUserId: userId,
        toUserId: userId,
        action: 'ARCHIVE',
        remarks: remarks || 'File archived',
      },
    });

    return updatedFile;
  }

  async restoreFile(fileId: string, userId: string, remarks?: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.status !== 'ARCHIVED') {
      throw new BadRequestException('File is not archived');
    }

    // Restore file to previous status or PENDING
    const updatedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        status: 'PENDING',
        archivedAt: null,
      },
      include: {
        department: true,
        currentOwner: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Log the restore action
    await this.prisma.fileMovement.create({
      data: {
        fileId,
        fromUserId: userId,
        toUserId: userId,
        action: 'RESTORE',
        remarks: remarks || 'File restored from archive',
      },
    });

    return updatedFile;
  }

  async disposeFile(fileId: string, userId: string, remarks?: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.status === 'DISPOSED') {
      throw new BadRequestException('File is already disposed');
    }

    // Update file status to disposed
    const updatedFile = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        status: 'DISPOSED',
      },
      include: {
        department: true,
      },
    });

    // Log the dispose action
    await this.prisma.fileMovement.create({
      data: {
        fileId,
        fromUserId: userId,
        toUserId: userId,
        action: 'DISPOSE',
        remarks: remarks || 'File disposed',
      },
    });

    return updatedFile;
  }

  async getArchivedFiles(query: {
    page?: number;
    limit?: number;
    departmentId?: string;
  }) {
    const { page = 1, limit = 10, departmentId } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      status: 'ARCHIVED',
    };

    if (departmentId) {
      where.departmentId = departmentId;
    }

    const [files, total] = await Promise.all([
      this.prisma.file.findMany({
        where,
        skip,
        take: limit,
        orderBy: { archivedAt: 'desc' },
        include: {
          department: true,
          currentOwner: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.file.count({ where }),
    ]);

    return {
      data: files,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
