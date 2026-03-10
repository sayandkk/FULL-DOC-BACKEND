import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateInwardDto } from './dto/create-inward.dto';
import { UpdateInwardDto } from './dto/update-inward.dto';

@Injectable()
export class InwardService {
  constructor(private prisma: PrismaService) { }

  private async generateInwardNumber(): Promise<string> {
    const year = new Date().getFullYear();

    // Get the last inward for this year
    const lastInward = await this.prisma.inward.findFirst({
      where: {
        inwardNumber: {
          startsWith: `IN-${year}-`,
        },
      },
      orderBy: {
        inwardNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastInward) {
      const lastNumber = parseInt(lastInward.inwardNumber.split('-')[2], 10);
      sequence = lastNumber + 1;
    }

    return `IN-${year}-${sequence.toString().padStart(4, '0')}`;
  }

  async create(createInwardDto: CreateInwardDto, userId: string) {
    const inwardNumber = await this.generateInwardNumber();

    return this.prisma.inward.create({
      data: {
        ...createInwardDto,
        inwardNumber,
        createdById: userId,
        referenceDate: createInwardDto.referenceDate
          ? new Date(createInwardDto.referenceDate)
          : undefined,
      },
      include: {
        department: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        documents: true,
      },
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    departmentId?: string;
    search?: string;
  }) {
    const { page = 1, limit = 10, departmentId, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { senderName: { contains: search, mode: 'insensitive' } },
        { inwardNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [inwards, total] = await Promise.all([
      this.prisma.inward.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          department: true,
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          files: {
            select: {
              id: true,
              fileNumber: true,
              subject: true,
              status: true,
            },
          },
          _count: {
            select: {
              documents: true,
              files: true,
            },
          },
        },
      }),
      this.prisma.inward.count({ where }),
    ]);

    return {
      data: inwards,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const inward = await this.prisma.inward.findUnique({
      where: { id },
      include: {
        department: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        documents: true,
        files: {
          include: {
            currentOwner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!inward) {
      throw new NotFoundException('Inward not found');
    }

    return inward;
  }

  async update(id: string, updateInwardDto: UpdateInwardDto) {
    await this.findOne(id);

    const data: any = { ...updateInwardDto };
    if (updateInwardDto.referenceDate) {
      data.referenceDate = new Date(updateInwardDto.referenceDate);
    }

    return this.prisma.inward.update({
      where: { id },
      data,
      include: {
        department: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async linkToFile(inwardId: string, fileId: string) {
    // Relationship lives on the File side (File.inwardId → Inward)
    // Update the file to point to this inward
    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: { inwardId },
      select: {
        id: true,
        fileNumber: true,
        subject: true,
        status: true,
        inwardId: true,
      },
    });
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.inward.delete({ where: { id } });
    return { message: 'Inward deleted successfully' };
  }
}
