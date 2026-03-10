import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  CreateClassificationDto,
  UpdateClassificationDto,
  SetRoutesDto,
} from './dto/classification.dto';
import { ClassificationType } from '@prisma/client';

@Injectable()
export class ClassificationsService {
  constructor(private prisma: PrismaService) { }

  async findAll() {
    return this.prisma.classification.findMany({
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        routes: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, role: true },
            },
          },
          orderBy: { order: 'asc' },
        },
        _count: { select: { files: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const c = await this.prisma.classification.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        routes: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
                designation: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!c) throw new NotFoundException('Classification not found');
    return c;
  }

  async create(dto: CreateClassificationDto, userId: string) {
    const existing = await this.prisma.classification.findUnique({
      where: { name: dto.name },
    });
    if (existing)
      throw new ConflictException(
        'Classification with this name already exists',
      );

    return this.prisma.classification.create({
      data: {
        name: dto.name,
        type: (dto.type as ClassificationType) || ClassificationType.NORMAL,
        description: dto.description,
        createdById: userId,
        routes: dto.routes
          ? {
            create: dto.routes.map((r) => ({
              userId: r.userId,
              order: r.order,
            })),
          }
          : undefined,
      },
      include: {
        routes: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, role: true },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async update(id: string, dto: UpdateClassificationDto) {
    await this.findOne(id);
    return this.prisma.classification.update({
      where: { id },
      data: dto,
      include: {
        routes: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, role: true },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async setRoutes(id: string, dto: SetRoutesDto) {
    await this.findOne(id);
    // Replace all routes atomically
    await this.prisma.classificationRoute.deleteMany({
      where: { classificationId: id },
    });
    await this.prisma.classificationRoute.createMany({
      data: dto.routes.map((r) => ({
        classificationId: id,
        userId: r.userId,
        order: r.order,
      })),
    });
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.classification.delete({ where: { id } });
  }

  /**
   * Given a file's classificationId and the current owner's userId,
   * returns the userId of the NEXT person in the routing order.
   * Returns null if no next person (end of chain).
   */
  async getNextRouteUser(
    classificationId: string,
    currentUserId: string,
    fileId?: string,
  ): Promise<string | null> {
    const routes = await this.prisma.classificationRoute.findMany({
      where: { classificationId },
      orderBy: { order: 'asc' },
    });

    let currentIndex = routes.findIndex((r) => r.userId === currentUserId);

    // If current user is not in the route, trace the history backward to find who they replaced
    if (currentIndex === -1 && fileId) {
      const movements = await this.prisma.fileMovement.findMany({
        where: { fileId },
        orderBy: { createdAt: 'desc' },
      });

      for (const movement of movements) {
        if (movement.toUserId) {
          const pastIndex = routes.findIndex(
            (r) => r.userId === movement.toUserId,
          );
          if (pastIndex !== -1) {
            currentIndex = pastIndex;
            break;
          }
        }
        if (movement.fromUserId) {
          const pastIndex = routes.findIndex(
            (r) => r.userId === movement.fromUserId,
          );
          if (pastIndex !== -1) {
            currentIndex = pastIndex;
            break;
          }
        }
      }
    }

    // If still not found, start from the first
    if (currentIndex === -1 && routes.length > 0) return routes[0].userId;

    // If there is a next person
    if (currentIndex >= 0 && currentIndex < routes.length - 1) {
      return routes[currentIndex + 1].userId;
    }
    return null; // end of chain
  }
}
