import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  CreateCategoryDto,
  CreateStageDto,
  ApprovalActionDto,
} from './dto/workflow.dto';
import { FileStatus, Role } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class WorkflowService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) { }

  // --- Categories ---
  async createCategory(dto: CreateCategoryDto) {
    return this.prisma.workflowCategory.create({ data: dto });
  }

  async listCategories() {
    return this.prisma.workflowCategory.findMany({
      include: { stages: { orderBy: { stageOrder: 'asc' } } },
    });
  }

  async getCategory(id: string) {
    const category = await this.prisma.workflowCategory.findUnique({
      where: { id },
      include: { stages: { orderBy: { stageOrder: 'asc' } } },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  // --- Stages ---
  async addStage(dto: CreateStageDto) {
    // Check if stage order already exists
    const exists = await this.prisma.workflowStage.findFirst({
      where: { categoryId: dto.categoryId, stageOrder: dto.stageOrder },
    });
    if (exists)
      throw new BadRequestException(
        'Stage order already exists for this category',
      );

    return this.prisma.workflowStage.create({ data: dto });
  }

  async removeStage(id: string) {
    return this.prisma.workflowStage.delete({ where: { id } });
  }

  // --- File Workflow Logic ---

  async getNextStage(categoryId: string, currentOrder: number = 0) {
    return this.prisma.workflowStage.findFirst({
      where: {
        categoryId,
        stageOrder: { gt: currentOrder },
      },
      orderBy: { stageOrder: 'asc' },
    });
  }

  async initiateWorkflow(fileId: string, categoryId: string) {
    const firstStage = await this.getNextStage(categoryId, 0);
    if (!firstStage) return; // No workflow configured, stays PENDING without stage

    await this.prisma.file.update({
      where: { id: fileId },
      data: {
        workflowCategoryId: categoryId,
        currentStageId: firstStage.id,
        status: 'PENDING',
      },
    });

    // Create initial approval record
    await this.prisma.fileApproval.create({
      data: {
        fileId,
        stageId: firstStage.id,
        status: 'PENDING',
      },
    });
  }

  async processApproval(
    fileId: string,
    userId: string,
    dto: ApprovalActionDto,
  ) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: { currentStage: true, createdBy: true },
    });

    if (
      !file ||
      !(file as any).currentStage ||
      !(file as any).workflowCategoryId
    ) {
      throw new BadRequestException('File is not in a workflow');
    }

    const currentStage = (file as any).currentStage;

    // Verify user role matches stage role (skip for now if admin override is needed, but let's enforce)
    // In real app, check user.role vs currentStage.role

    // Update current approval record
    const currentApproval = await this.prisma.fileApproval.findFirst({
      where: { fileId, stageId: currentStage.id, status: 'PENDING' },
    });

    if (currentApproval) {
      await this.prisma.fileApproval.update({
        where: { id: currentApproval.id },
        data: {
          status: dto.status,
          approvedByUserId: userId,
          comments: dto.comments,
          actionDate: new Date(),
        },
      });
    }

    let newFileStatus: string = 'PENDING';

    // Move to next stage if APPROVED
    if (dto.status === 'APPROVED') {
      const nextStage = await this.getNextStage(
        (file as any).workflowCategoryId,
        currentStage.stageOrder,
      );

      if (nextStage) {
        // Move to next stage
        await this.prisma.file.update({
          where: { id: fileId },
          data: { currentStageId: nextStage.id, status: 'PENDING' },
        });

        // Create new approval record for next stage
        await this.prisma.fileApproval.create({
          data: {
            fileId,
            stageId: nextStage.id,
            status: 'PENDING',
          },
        });
        newFileStatus = 'PENDING';
      } else {
        // Workflow complete
        await this.prisma.file.update({
          where: { id: fileId },
          data: { status: 'APPROVED', currentStageId: null },
        });
        newFileStatus = 'APPROVED';
      }
    } else if (dto.status === 'REJECTED' || dto.status === 'RETURNED') {
      // Stop workflow, mark file
      const rejectionOrReturnStatus =
        dto.status === 'REJECTED' ? 'REJECTED' : 'RETURNED';
      await this.prisma.file.update({
        where: { id: fileId },
        data: {
          status: rejectionOrReturnStatus,
          currentStageId: null,
          ...(dto.status === 'RETURNED'
            ? { currentOwnerId: (file as any).createdById }
            : {}),
        },
      });
      newFileStatus = rejectionOrReturnStatus;
    }

    // ── Notifications ────────────────────────────────────────────────────────
    const fileCreatorId: string = (file as any).createdById;
    if (fileCreatorId) {
      if (newFileStatus === 'APPROVED') {
        this.notifications.notifyUser(fileCreatorId, {
          type: 'WORKFLOW_COMPLETED',
          title: '✅ File Approved',
          message: `Your file "${(file as any).subject}" (${(file as any).fileNumber}) has been fully approved.`,
          entityId: fileId,
          entityType: 'file',
          link: `/dashboard/files`,
        });
      } else if (newFileStatus === 'REJECTED') {
        this.notifications.notifyUser(fileCreatorId, {
          type: 'WORKFLOW_REJECTED',
          title: '❌ File Rejected',
          message: `Your file "${(file as any).subject}" (${(file as any).fileNumber}) was rejected. Reason: ${dto.comments ?? 'No reason provided'}.`,
          entityId: fileId,
          entityType: 'file',
          link: `/dashboard/files`,
        });
      } else if (newFileStatus === 'RETURNED') {
        this.notifications.notifyUser(fileCreatorId, {
          type: 'WORKFLOW_REJECTED',
          title: '↩️ File Returned for Revision',
          message: `Your file "${(file as any).subject}" (${(file as any).fileNumber}) was returned. Remarks: ${dto.comments ?? 'None'}.`,
          entityId: fileId,
          entityType: 'file',
          link: `/dashboard/files`,
        });
      } else if (newFileStatus === 'PENDING') {
        // Moved to the next stage — notify creator
        this.notifications.notifyUser(fileCreatorId, {
          type: 'WORKFLOW_APPROVAL',
          title: '📋 File Moved to Next Stage',
          message: `Your file "${(file as any).subject}" (${(file as any).fileNumber}) was approved at stage "${currentStage.stageName}" and is awaiting the next review.`,
          entityId: fileId,
          entityType: 'file',
          link: `/dashboard/files`,
        });
      }
    }

    // Master File Sync Logic
    if ((file as any).parentId) {
      if (newFileStatus === 'APPROVED' || newFileStatus === 'CLOSED') {
        const parent = (await (this.prisma as any).file.findUnique({
          where: { id: (file as any).parentId },
          include: { children: { select: { status: true } } },
        })) as any;

        if (
          parent &&
          parent.status !== 'APPROVED' &&
          parent.status !== 'CLOSED'
        ) {
          const allApproved = parent.children.every(
            (c: any) => c.status === 'APPROVED' || c.status === 'CLOSED',
          );

          if (allApproved) {
            await (this.prisma as any).file.update({
              where: { id: parent.id },
              data: { status: 'APPROVED' },
              include: { children: true },
            });
            await this.prisma.fileMovement.create({
              data: {
                fileId: parent.id,
                action: 'APPROVE',
                remarks:
                  'Auto-approved: all sub-files have been approved/closed.',
              },
            });
          }
        }
      } else {
        // Sub-file changed to PENDING, REJECTED, RETURNED, etc.
        // Force parent to PENDING if it was previously APPROVED/CLOSED
        const parent = (await (this.prisma as any).file.findUnique({
          where: { id: (file as any).parentId },
          select: { id: true, status: true },
        })) as any;

        if (
          parent &&
          (parent.status === 'APPROVED' || parent.status === 'CLOSED')
        ) {
          await (this.prisma as any).file.update({
            where: { id: parent.id },
            data: { status: 'PENDING' },
          });
          await this.prisma.fileMovement.create({
            data: {
              fileId: parent.id,
              action: 'RETURN',
              remarks: `Auto-reverted to PENDING: sub-file ${(file as any).fileNumber} workflow status changed to ${newFileStatus}.`,
            },
          });
        }
      }
    }
  }

  async getFileApprovals(fileId: string) {
    return this.prisma.fileApproval.findMany({
      where: { fileId },
      include: {
        stage: true,
        approvedBy: { select: { firstName: true, lastName: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
