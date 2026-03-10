import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { ConvertRequestToFileDto } from './dto/convert-request-to-file.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class RequestsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) { }

  private get client() {
    return this.prisma as any;
  }

  async create(dto: CreateRequestDto, userId: string) {
    // Temporary request number generation
    const year = new Date().getFullYear();
    const lastRequest = await this.client.request.findFirst({
      where: {
        requestNumber: {
          startsWith: `REQ-${year}-`,
        },
      },
      orderBy: { requestNumber: 'desc' },
    });

    let sequence = 1;
    if (lastRequest && lastRequest.requestNumber) {
      const parts = lastRequest.requestNumber.split('-');
      if (parts.length >= 3) {
        sequence = parseInt(parts[2], 10) + 1;
      }
    }

    const requestNumber = `REQ-${year}-${sequence.toString().padStart(4, '0')}`;

    return this.client.request.create({
      data: {
        ...dto,
        requestNumber,
        createdById: userId,
        status: 'SUBMITTED',
      },
    });
  }

  async findAll(params?: { status?: string; type?: string; search?: string }) {
    const where: any = {};

    if (params?.status) where.status = params.status;
    if (params?.type) where.requestType = params.type;
    if (params?.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
        { requestNumber: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    return this.client.request.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: true,
        assignedTo: true,
        files: true,
      },
    });
  }

  async findOne(id: string) {
    const request = await this.client.request.findUnique({
      where: { id },
      include: {
        createdBy: true,
        assignedTo: true,
        files: true,
        documents: true,
        activities: true,
      },
    });

    if (!request) throw new NotFoundException('Request not found');
    return request;
  }

  async update(id: string, dto: UpdateRequestDto) {
    const existing = await this.findOne(id);
    const updated = await this.client.request.update({
      where: { id },
      data: dto,
    });

    // Notify creator when status changes
    if ((dto as any).status && (dto as any).status !== existing.status && existing.createdById) {
      const statusMessages: Record<string, { title: string; message: string }> = {
        APPROVED: {
          title: '✅ Request Approved',
          message: `Your request "${existing.title}" (${existing.requestNumber}) has been approved.`,
        },
        REJECTED: {
          title: '❌ Request Rejected',
          message: `Your request "${existing.title}" (${existing.requestNumber}) was rejected.`,
        },
        IN_REVIEW: {
          title: '🔍 Request Under Review',
          message: `Your request "${existing.title}" (${existing.requestNumber}) is now under review.`,
        },
        COMPLETED: {
          title: '🎉 Request Completed',
          message: `Your request "${existing.title}" (${existing.requestNumber}) has been marked as completed.`,
        },
      };
      const msg = statusMessages[(dto as any).status as string];
      if (msg) {
        this.notifications.notifyUser(existing.createdById, {
          type: 'REQUEST_STATUS',
          ...msg,
          entityId: id,
          entityType: 'request',
          link: `/dashboard/requests/${id}`,
        });
      }
    }

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.client.request.delete({ where: { id } });
    return { message: 'Request deleted successfully' };
  }

  async attachDocument(
    requestId: string,
    file: Express.Multer.File & { buffer: Buffer },
    userId: string,
  ) {
    await this.findOne(requestId);

    return this.client.requestDocument.create({
      data: {
        requestId,
        filename: file.filename || `${Date.now()}-${file.originalname}`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        content: file.buffer,
        uploadedById: userId,
      },
    });
  }

  async logActivity(
    requestId: string,
    action: string,
    description?: string,
    metadata?: Record<string, any>,
  ) {
    return this.client.requestActivity.create({
      data: {
        requestId,
        action,
        description,
        metadata,
      },
    });
  }

  async convertToFile(
    requestId: string,
    dto: ConvertRequestToFileDto,
    userId: string,
  ) {
    const request = await this.findOne(requestId);

    // Temporary file number generation (will be replaced by configurable numbering in Phase 3)
    const year = new Date().getFullYear();
    const lastFile = await this.client.file.findFirst({
      where: {
        fileNumber: {
          startsWith: `F-${year}-`,
        },
      },
      orderBy: { fileNumber: 'desc' },
    });

    let sequence = 1;
    if (lastFile) {
      const lastNumber = parseInt(lastFile.fileNumber.split('-')[2], 10);
      sequence = lastNumber + 1;
    }

    const fileNumber = `F-${year}-${sequence.toString().padStart(4, '0')}`;

    const file = await this.client.file.create({
      data: {
        fileNumber,
        subject: dto.subject || request.title,
        description: dto.description || request.description,
        departmentId: dto.departmentId,
        createdById: userId,
        currentOwnerId: userId,
        requestId: request.id,
        priority: request.priority ?? 'NORMAL',
        confidentiality: request.confidentiality ?? 'INTERNAL',
        category: request.category ?? 'OTHER',
      } as any,
    });

    await this.logActivity(
      requestId,
      'CONVERTED_TO_FILE',
      `Request converted to file ${file.id}`,
      {
        fileId: file.id,
      },
    );

    return file;
  }
}
