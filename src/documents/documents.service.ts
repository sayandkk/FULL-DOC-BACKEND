import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async uploadFile(
    file: Express.Multer.File & { buffer: Buffer },
    userId: string,
    metadata: {
      inwardId?: string;
      fileId?: string;
      description?: string;
      heading?: string;
    },
  ) {
    const maxFileSize =
      this.configService.get<number>('MAX_FILE_SIZE') || 52428800; // 50MB

    if (file.size > maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${maxFileSize / 1024 / 1024}MB`,
      );
    }

    // Calculate SHA-256 checksum
    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    // Generate version
    let version = '1.0';
    if (metadata.fileId || metadata.inwardId) {
      const latestDoc = await this.prisma.document.findFirst({
        where: {
          OR: [
            metadata.fileId ? { fileId: metadata.fileId } : {},
            metadata.inwardId ? { inwardId: metadata.inwardId } : {},
          ],
          // Versioning is scoped by heading if provided, otherwise null heading
          heading: metadata.heading || null,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (latestDoc) {
        const [major, minor] = latestDoc.version.split('.').map(Number);
        version = `${major + 1}.0`;
      }
    }

    const document = await this.prisma.document.create({
      data: {
        filename: file.filename || `${Date.now()}-${file.originalname}`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        content: file.buffer as any,
        version,
        inwardId: metadata.inwardId,
        fileId: metadata.fileId,
        uploadedById: userId,
        description: metadata.description,
        heading: metadata.heading,
        checksum,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { content, ...result } = document;
    return result;
  }

  async findByFile(fileId: string) {
    const documents = await this.prisma.document.findMany({
      where: { fileId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { heading: 'asc' }, // Group by heading
        { createdAt: 'desc' },
      ],
    });

    return documents.map((doc) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { content, ...result } = doc;
      return result;
    });
  }

  async findByInward(inwardId: string) {
    const documents = await this.prisma.document.findMany({
      where: { inwardId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [{ heading: 'asc' }, { createdAt: 'desc' }],
    });

    return documents.map((doc) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { content, ...result } = doc;
      return result;
    });
  }

  async findOne(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        uploadedBy: {
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
        inward: {
          select: {
            id: true,
            inwardNumber: true,
            subject: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { content, ...result } = document;
    return result;
  }

  async download(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.document.delete({ where: { id } });
    return { message: 'Document deleted successfully' };
  }
}
