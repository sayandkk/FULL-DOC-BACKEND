import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async search(query: string, type?: string, from?: string, to?: string) {
    const dateFilter: any = {};
    if (from) {
      dateFilter.gte = new Date(from);
    }
    if (to) {
      dateFilter.lte = new Date(to);
    }

    const results: any = {};

    // Search Files
    if (!type || type === 'files') {
      results.files = await this.prisma.file.findMany({
        where: {
          OR: [
            { subject: { contains: query, mode: 'insensitive' } },
            { fileNumber: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        },
        include: {
          department: true,
          currentOwner: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        take: 20,
      });
    }

    // Search Inwards
    if (!type || type === 'inwards') {
      results.inwards = await this.prisma.inward.findMany({
        where: {
          OR: [
            { subject: { contains: query, mode: 'insensitive' } },
            { inwardNumber: { contains: query, mode: 'insensitive' } },
            { senderName: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        },
        include: {
          department: true,
        },
        take: 20,
      });
    }

    // Search Notes
    if (!type || type === 'notes') {
      results.notes = await this.prisma.note.findMany({
        where: {
          content: { contains: query, mode: 'insensitive' },
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        },
        include: {
          file: {
            select: { id: true, fileNumber: true, subject: true },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        take: 20,
      });
    }

    return results;
  }
}
