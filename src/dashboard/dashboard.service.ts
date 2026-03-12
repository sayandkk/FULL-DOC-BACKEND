import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) { }

  async getStats(user: any) {
    const now = new Date();
    const userId = user.id;

    // Filter files based on user visibility rules (same as files.service.ts)
    let fileWhere: any = { isMaster: false };

    if (user.role !== 'ADMIN') {
      const isDeptHead = user.role === 'DEPT_HEAD';

      const departmentCondition = isDeptHead
        ? { departmentId: user.departmentId }
        : { AND: [{ departmentId: user.departmentId }, { isMaster: false }] };

      const movementsCondition = {
        AND: [
          { isMaster: false },
          {
            movements: {
              some: {
                OR: [{ fromUserId: user.id }, { toUserId: user.id }],
              },
            },
          },
        ],
      };

      fileWhere.OR = [
        { currentOwnerId: user.id },
        { createdById: user.id },
        departmentCondition,
        movementsCondition,
      ];
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      pendingFiles,
      approvedFiles,
      returnedFiles,
      archivedFiles,
      totalInwards,
      totalUsers,
      myPendingFiles,
      myFiles,
      overdueFiles,
      slaEscalationsOpen,
      storageResult,
      recentMovements,
    ] = await Promise.all([
      (this.prisma as any).file.count({
        where: { ...fileWhere, status: 'PENDING' },
      }),
      (this.prisma as any).file.count({
        where: { ...fileWhere, status: 'APPROVED' },
      }),
      (this.prisma as any).file.count({
        where: { ...fileWhere, status: 'RETURNED' },
      }),
      (this.prisma as any).file.count({
        where: { ...fileWhere, status: 'ARCHIVED' },
      }),
      (this.prisma as any).inward.count({
        where: user.role === 'ADMIN' ? {} : { departmentId: user.departmentId },
      }),
      (this.prisma as any).user.count({
        where: {
          status: 'ACTIVE',
          ...(user.role === 'ADMIN' ? {} : { departmentId: user.departmentId }),
        },
      }),
      (this.prisma as any).file.count({
        where: {
          currentOwnerId: userId,
          status: { in: ['PENDING', 'FORWARDED', 'RETURNED'] },
          isMaster: false,
        },
      }),
      (this.prisma as any).file.count({
        where: { currentOwnerId: userId, isMaster: false },
      }),
      (this.prisma as any).file.count({
        where: { ...fileWhere, status: 'PENDING', dueDate: { lt: now } },
      }),
      (this.prisma as any).sLAEscalation.count({
        where: {
          resolvedAt: null,
          ...(user.role !== 'ADMIN'
            ? { file: { departmentId: user.departmentId } }
            : {}),
        },
      }),
      (this.prisma as any).document.aggregate({
        _sum: { size: true }
      }),
      (this.prisma as any).fileMovement.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo },
        },
        select: { createdAt: true }
      }),
    ]);

    const totalStorageBytes = storageResult._sum?.size || 0;

    const weeklyTrend = Array(7).fill(0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    let filesProcessedThisWeek = 0;

    recentMovements.forEach((m: any) => {
      const diffTime = Math.abs(endOfDay.getTime() - new Date(m.createdAt).getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) {
        weeklyTrend[6 - diffDays]++;
        filesProcessedThisWeek++;
      }
    });

    return {
      overview: {
        pendingFiles,
        approvedFiles,
        returnedFiles,
        archivedFiles,
        totalInwards,
        totalUsers,
        overdueFiles,
        slaEscalationsOpen,
        filesProcessedThisWeek,
        weeklyTrend,
        totalStorageBytes,
      },
      personal: {
        myPendingFiles,
        myFiles,
      },
    };
  }

  async getRecentFiles(user: any, limit: number = 5) {
    let fileWhere: any = { isMaster: false };

    if (user.role !== 'ADMIN') {
      const isDeptHead = user.role === 'DEPT_HEAD';
      const departmentCondition = isDeptHead
        ? { departmentId: user.departmentId }
        : { AND: [{ departmentId: user.departmentId }, { isMaster: false }] };
      const movementsCondition = {
        AND: [
          { isMaster: false },
          {
            movements: {
              some: { OR: [{ fromUserId: user.id }, { toUserId: user.id }] },
            },
          },
        ],
      };

      fileWhere.OR = [
        { currentOwnerId: user.id },
        { createdById: user.id },
        departmentCondition,
        movementsCondition,
      ];
    }

    return (this.prisma as any).file.findMany({
      where: fileWhere,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        department: true,
        currentOwner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async getPendingActions(userId: string) {
    return (this.prisma as any).file.findMany({
      where: {
        currentOwnerId: userId,
        status: { in: ['PENDING', 'FORWARDED', 'RETURNED'] },
        isMaster: false,
      },
      include: {
        department: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getWorkflowStats(user: any) {
    let fileWhere: any = { isMaster: false };

    if (user.role !== 'ADMIN') {
      const isDeptHead = user.role === 'DEPT_HEAD';
      const departmentCondition = isDeptHead
        ? { departmentId: user.departmentId }
        : { AND: [{ departmentId: user.departmentId }, { isMaster: false }] };
      const movementsCondition = {
        AND: [
          { isMaster: false },
          {
            movements: {
              some: { OR: [{ fromUserId: user.id }, { toUserId: user.id }] },
            },
          },
        ],
      };

      fileWhere.OR = [
        { currentOwnerId: user.id },
        { createdById: user.id },
        departmentCondition,
        movementsCondition,
      ];
    }

    const stages = await (this.prisma as any).workflowStage.findMany({
      include: {
        category: true,
        currentFiles: {
          where: { ...fileWhere, status: 'PENDING' },
        },
      },
      orderBy: { stageOrder: 'asc' },
    });

    const now = new Date();

    return stages.map((s: any) => {
      const pendingCount = s.currentFiles.length;
      const ages = s.currentFiles.map(
        (f: any) => now.getTime() - new Date(f.createdAt).getTime(),
      );
      const avgAgeMs = ages.length
        ? ages.reduce((a: number, b: number) => a + b, 0) / ages.length
        : 0;
      const avgAgeHours = avgAgeMs / (1000 * 60 * 60);

      return {
        stageId: s.id,
        stageOrder: s.stageOrder,
        role: s.role,
        categoryId: s.categoryId,
        categoryName: s.category?.name,
        pendingCount,
        avgAgeHours,
      };
    });
  }
}
