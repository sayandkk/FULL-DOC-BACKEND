import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { WorkflowService } from '../workflow/workflow.service';
import { ClassificationsService } from '../classifications/classifications.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateFileDto } from './dto/create-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { MoveFileDto } from './dto/move-file.dto';

@Injectable()
export class FilesService {
  constructor(
    private prisma: PrismaService,
    private workflowService: WorkflowService,
    private classificationsService: ClassificationsService,
    private notifications: NotificationsService,
  ) { }

  async generateFileNumber(category?: string): Promise<string> {
    const year = new Date().getFullYear();

    // Try configurable numbering first
    const normalizedCategory = category || 'OTHER';
    const client = this.prisma as any;
    const config = await client.fileNumberingConfig.findUnique({
      where: { category: normalizedCategory as any },
    });

    if (config && config.isActive) {
      // Reset sequence when year changes
      let currentYear = config.currentYear;
      let currentSeq = config.currentSeq;
      if (currentYear !== year) {
        currentYear = year;
        currentSeq = 0;
      }

      const nextSeq = currentSeq + 1;

      await client.fileNumberingConfig.update({
        where: { id: config.id },
        data: {
          currentYear,
          currentSeq: nextSeq,
        },
      });

      // Build number from format
      const padMatch = config.format.match(/\{SEQ:(\d+)\}/);
      const width = padMatch ? parseInt(padMatch[1], 10) : 4;
      const seqStr = String(nextSeq).padStart(width, '0');

      let result = config.format;
      result = result.replace('{PREFIX}', config.prefix);
      result = result.replace('{YYYY}', year.toString());
      result = result.replace('{YY}', year.toString().slice(-2));
      result = result.replace('{CATEGORY}', normalizedCategory);
      result = result.replace(/\{SEQ:\d+\}/, seqStr);

      return result;
    }

    // Fallback: legacy pattern F-YYYY-####
    const lastFile = await this.prisma.file.findFirst({
      where: {
        fileNumber: {
          startsWith: `F-${year}-`,
        },
      },
      orderBy: {
        fileNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastFile) {
      const lastNumber = parseInt(lastFile.fileNumber.split('-')[2], 10);
      sequence = lastNumber + 1;
    }

    return `F-${year}-${sequence.toString().padStart(4, '0')}`;
  }

  async create(createFileDto: CreateFileDto, userId: string) {
    const categoryForNumbering = (createFileDto as any).category;
    const fileNumber = await this.generateFileNumber(categoryForNumbering);

    const now = new Date();
    const rawDueDate = (createFileDto as any).dueDate as string | undefined;
    const slaHours = (createFileDto as any).slaHours as number | undefined;

    let dueDate: Date | undefined;
    if (rawDueDate) {
      dueDate = new Date(rawDueDate);
    } else if (slaHours && slaHours > 0) {
      dueDate = new Date(now.getTime() + slaHours * 60 * 60 * 1000);
    }

    const { isMaster, childFileIds, ...restDto } = createFileDto;

    const file = await (this.prisma as any).file.create({
      data: {
        ...restDto,
        isMaster: isMaster || false,
        ...(dueDate ? { dueDate: dueDate as any } : {}),
        fileNumber,
        createdById: userId,
        currentOwnerId: userId,
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
        currentOwner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        inward: true,
        workflowCategory: true,
        currentStage: true,
        classification: { select: { id: true, name: true, type: true } },
      },
    });

    // Log file creation movement
    await this.prisma.fileMovement.create({
      data: {
        fileId: file.id,
        toUserId: userId,
        action: 'CREATE',
        remarks: 'File created',
      },
    });

    // Notify department heads when a new file is created in their department
    const departmentHeads = await this.prisma.user.findMany({
      where: {
        departmentId: file.departmentId,
        role: 'DEPT_HEAD',
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    await Promise.all(
      departmentHeads
        .filter((head) => head.id !== userId)
        .map((head) =>
          this.notifications.notifyUser(head.id, {
            type: 'FILE_ASSIGNED',
            title: '📁 New File Created in Your Department',
            message: `A new file ${fileNumber} (${file.subject}) was created in your department.`,
            entityId: file.id,
            entityType: 'file',
            link: `/dashboard/files`,
          }),
        ),
    );

    if (file.currentOwnerId && file.currentOwnerId !== userId) {
      this.notifications.notifyUser(file.currentOwnerId, {
        type: 'FILE_ASSIGNED',
        title: '📂 New File Assigned',
        message: `A new file ${fileNumber} has been assigned to you.`,
        entityId: file.id,
        entityType: 'file',
        link: `/dashboard/files`,
      });
    }

    // Handle linking    // If it's a MASTER file, bind the children
    if (isMaster && childFileIds && childFileIds.length > 0) {
      await (this.prisma as any).file.updateMany({
        where: { id: { in: childFileIds } },
        data: { parentId: file.id },
      });
    }

    // Initiate workflow if category is present
    if (createFileDto.workflowCategoryId) {
      await this.workflowService.initiateWorkflow(
        file.id,
        createFileDto.workflowCategoryId,
      );
      // Reload file to get updated status/stage
      return this.findOne(file.id);
    }

    return file;
  }

  async findAll(
    query: {
      page?: number;
      limit?: number;
      status?: string;
      departmentId?: string;
      search?: string;
      priority?: string;
      category?: string;
      confidentiality?: string;
      isMaster?: boolean;
    },
    currentUser?: any,
  ) {
    const {
      page = 1,
      limit = 10,
      status,
      departmentId,
      search,
      priority,
      category,
      confidentiality,
      isMaster,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (isMaster !== undefined) {
      where.isMaster = isMaster;
    }

    if (currentUser && currentUser.role !== 'ADMIN') {
      const isDeptHead = currentUser.role === 'DEPT_HEAD';

      const departmentCondition = isDeptHead
        ? { departmentId: currentUser.departmentId }
        : {
          AND: [
            { departmentId: currentUser.departmentId },
            { isMaster: false },
          ],
        };

      const movementsCondition = {
        AND: [
          { isMaster: false },
          {
            movements: {
              some: {
                OR: [
                  { fromUserId: currentUser.id },
                  { toUserId: currentUser.id },
                ],
              },
            },
          },
        ],
      };

      where.OR = [
        { currentOwnerId: currentUser.id },
        { createdById: currentUser.id },
        departmentCondition,
        movementsCondition,
      ];
    } else {
      // Admin can see everything, or filter by specific department if requested
      if (departmentId) {
        where.departmentId = departmentId;
      }
    }

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (category) {
      where.category = category;
    }

    if (confidentiality) {
      where.confidentiality = confidentiality;
    }

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { subject: { contains: search, mode: 'insensitive' } },
            { fileNumber: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [files, total] = await Promise.all([
      (this.prisma as any).file.findMany({
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
          currentOwner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          inward: true,
          workflowCategory: true,
          currentStage: true,
          classification: { select: { id: true, name: true, type: true } },
          parent: {
            select: { id: true, subject: true, fileNumber: true, status: true },
          },
          children: {
            select: { id: true, subject: true, fileNumber: true, status: true },
          },
          _count: {
            select: {
              documents: true,
              notes: true,
            },
          },
        },
      }),
      (this.prisma as any).file.count({ where }),
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

  async findOne(id: string) {
    const file = await (this.prisma as any).file.findUnique({
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
        currentOwner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        workflowCategory: true,
        currentStage: true,
        classification: { select: { id: true, name: true, type: true } },
        parent: {
          select: { id: true, subject: true, fileNumber: true, status: true },
        },
        children: {
          select: { id: true, subject: true, fileNumber: true, status: true },
        },
        adhocNextUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        approvals: {
          include: {
            stage: true,
            approvedBy: {
              select: { firstName: true, lastName: true, role: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        inward: {
          include: {
            department: true,
          },
        },
        notes: {
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  async update(id: string, updateFileDto: UpdateFileDto | any) {
    await this.findOne(id);

    const { childFileIds, isMaster, ...restDto } = updateFileDto;

    const data: any = { ...restDto };

    if (isMaster !== undefined) {
      data.isMaster = isMaster;
    }

    if (childFileIds && Array.isArray(childFileIds)) {
      // Disconnect all existing children first, then connect the new ones
      data.children = {
        set: [], // Disconnect existing
        connect: childFileIds.map((childId: string) => ({ id: childId })),
      };

      // Check statuses of the newly connected children
      const children = await (this.prisma as any).file.findMany({
        where: { id: { in: childFileIds } },
        select: { status: true },
      });

      if (children.length > 0) {
        const allApproved = children.every(
          (c: any) => c.status === 'APPROVED' || c.status === 'CLOSED',
        );
        data.status = allApproved ? 'APPROVED' : 'PENDING';
      }
    }

    return (this.prisma as any).file.update({
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
        currentOwner: {
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

  async moveFile(
    id: string,
    moveFileDto: MoveFileDto | any,
    fromUserId: string,
  ) {
    const { toUserId: rawToUserId, action, remarks, adhocUserId } = moveFileDto;

    const file = await this.findOne(id);

    let resolvedToUserId: string | undefined = rawToUserId;

    let setAdhocData = false;
    let clearAdhocData = false;
    let adhocNextTarget: string | null = null;
    let isAdhocReturn = false;

    // Check if we are completing an ad-hoc route
    if (
      (action === 'FORWARD' || action === 'APPROVE') &&
      file.adhocNextUserId &&
      !adhocUserId &&
      !rawToUserId
    ) {
      resolvedToUserId = file.adhocNextUserId;
      clearAdhocData = true;
      isAdhocReturn = true;
    }

    if (action === 'FORWARD' && !isAdhocReturn) {
      if (file.classificationId) {
        const classification = await this.prisma.classification.findUnique({
          where: { id: file.classificationId },
          select: { type: true },
        });

        if (classification?.type === 'CUSTOM' && !rawToUserId) {
          const nextUser = await this.classificationsService.getNextRouteUser(
            file.classificationId,
            fromUserId,
            id,
          );

          if (!nextUser) {
            const deptHead = await this.prisma.user.findFirst({
              where: {
                departmentId: file.departmentId,
                role: { in: ['DEPT_HEAD', 'ADMIN'] },
              },
            });

            if (!deptHead) {
              console.log(
                `[FilesService] No DEPT_HEAD or ADMIN found for department ${file.departmentId}. Falling back to global ADMIN department head.`,
              );

              // Fallback: Find the ADMIN department
              const adminDept = await this.prisma.department.findUnique({
                where: { code: 'ADMIN' },
              });

              if (adminDept) {
                const globalHead = await this.prisma.user.findFirst({
                  where: {
                    departmentId: adminDept.id,
                    role: { in: ['DEPT_HEAD', 'ADMIN'] },
                  },
                });

                if (globalHead) {
                  resolvedToUserId = globalHead.id;
                }
              }
            } else {
              resolvedToUserId = deptHead.id;
            }

            if (!resolvedToUserId) {
              throw new BadRequestException(
                `End of route. No Department Head found for department: ${file.department?.name} and no Global Admin found.`,
              );
            }
          } else {
            resolvedToUserId = nextUser;
          }
        }
      }

      // If B wants to insert D:
      if (adhocUserId) {
        if (!resolvedToUserId) {
          throw new BadRequestException(
            'Target user is required to determine where the file returns after ad-hoc approval',
          );
        }
        adhocNextTarget = resolvedToUserId;
        resolvedToUserId = adhocUserId;
        setAdhocData = true;
      }
    }

    // If after checking auto-route we still don't have a target user for a FORWARD action, fail
    if (!resolvedToUserId && action === 'FORWARD') {
      throw new BadRequestException('Target user is required for forwarding');
    }

    // RETURN must specify who should receive the file for resubmission
    if (!resolvedToUserId && action === 'RETURN') {
      throw new BadRequestException('Target user is required for return action');
    }

    // For APPROVE/REJECT/etc the current user keeps the file until routed, so toUserId defaults to fromUserId
    const toUserId: string = resolvedToUserId || fromUserId;

    // Update file status and owner based on action
    let newStatus:
      | 'PENDING'
      | 'APPROVED'
      | 'RETURNED'
      | 'REJECTED'
      | 'CLOSED'
      | 'ARCHIVED'
      | 'FORWARDED' = 'PENDING';
    let closedAt = null;

    switch (action) {
      case 'APPROVE':
        newStatus = isAdhocReturn ? 'PENDING' : 'APPROVED';
        break;
      case 'RETURN':
        newStatus = 'RETURNED';
        break;
      case 'REJECT':
        newStatus = 'REJECTED';
        break;
      case 'CLOSE':
        newStatus = 'CLOSED';
        closedAt = new Date();
        break;
      case 'ARCHIVE':
        newStatus = 'ARCHIVED';
        break;
      default:
        newStatus = 'FORWARDED';
    }

    const updatedFile = await this.prisma.file.update({
      where: { id },
      data: {
        status: newStatus,
        currentOwnerId: toUserId,
        closedAt,
        ...(setAdhocData ? { adhocNextUserId: adhocNextTarget } : {}),
        ...(clearAdhocData
          ? { adhocNextUserId: null, adhocApprovedById: fromUserId }
          : {}),
      },
      include: {
        department: true,
        currentOwner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    let finalRemarks = remarks;
    if (setAdhocData) {
      finalRemarks = `[ADHOC_INSERT] ${remarks || ''}`.trim();
    } else if (isAdhocReturn) {
      finalRemarks = `[ADHOC_RETURN] ${remarks || ''}`.trim();
    }

    // Create movement log
    await this.prisma.fileMovement.create({
      data: {
        fileId: id,
        fromUserId,
        toUserId,
        action,
        remarks: finalRemarks,
      },
    });

    // ── Notifications ────────────────────────────────────────────────────
    const fileName = `"${(file as any).subject}" (${(file as any).fileNumber})`;
    // Notify the new owner when file is forwarded to them
    if (action === 'FORWARD' && toUserId && toUserId !== fromUserId) {
      const forwardMsg = setAdhocData
        ? `You have been added as an ad-hoc approver for file ${fileName}.`
        : isAdhocReturn
          ? `File ${fileName} was returned to you from ad-hoc approval.`
          : `File ${fileName} has been forwarded to you for review.`;
      this.notifications.notifyUser(toUserId, {
        type: 'FILE_ASSIGNED',
        title: '📂 File Forwarded to You',
        message: forwardMsg,
        entityId: id,
        entityType: 'file',
        link: `/dashboard/files`,
      });
    }
    // Notify the creator on status-changing actions
    const creatorId: string | undefined = (file as any).createdById;
    if (creatorId && creatorId !== fromUserId) {
      if (newStatus === 'APPROVED') {
        this.notifications.notifyUser(creatorId, {
          type: 'WORKFLOW_COMPLETED',
          title: '✅ File Approved',
          message: `Your file ${fileName} has been approved.`,
          entityId: id,
          entityType: 'file',
          link: `/dashboard/files`,
        });
      } else if (newStatus === 'REJECTED') {
        this.notifications.notifyUser(creatorId, {
          type: 'WORKFLOW_REJECTED',
          title: '❌ File Rejected',
          message: `Your file ${fileName} was rejected. Remarks: ${remarks ?? 'None'}.`,
          entityId: id,
          entityType: 'file',
          link: `/dashboard/files`,
        });
      } else if (newStatus === 'RETURNED') {
        this.notifications.notifyUser(creatorId, {
          type: 'WORKFLOW_REJECTED',
          title: '↩️ File Returned for Revision',
          message: `Your file ${fileName} was returned. Remarks: ${remarks ?? 'None'}.`,
          entityId: id,
          entityType: 'file',
          link: `/dashboard/files`,
        });
      }
    }

    // Notify return recipient so they can revise and resubmit
    if (action === 'RETURN' && toUserId && toUserId !== fromUserId) {
      this.notifications.notifyUser(toUserId, {
        type: 'WORKFLOW_REJECTED',
        title: '↩️ File Returned to You',
        message: `File ${fileName} was returned to you for revision and resubmission.`,
        entityId: id,
        entityType: 'file',
        link: `/dashboard/files`,
      });
    }

    // Check Auto-Approve / Auto-Revert for Master Files
    if (file.parentId) {
      if (newStatus === 'APPROVED' || newStatus === 'CLOSED') {
        const parent = (await (this.prisma as any).file.findUnique({
          where: { id: file.parentId },
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
            // Then auto-approve the parent
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
        // Sub-file is now PENDING, FORWARDED, RETURNED, REJECTED, etc.
        // Revert parent Master File to PENDING if it was previously APPROVED/CLOSED
        const parent = (await (this.prisma as any).file.findUnique({
          where: { id: file.parentId },
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
              action: 'RETURN', // Use "RETURN" or "CREATE" or a generic system action
              remarks: `Auto-reverted to PENDING: sub-file ${file.fileNumber} status changed to ${newStatus}.`,
            },
          });
        }
      }
    }

    return updatedFile;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.file.delete({ where: { id } });
    return { message: 'File deleted successfully' };
  }

  async getMovements(id: string) {
    await this.findOne(id);

    return this.prisma.fileMovement.findMany({
      where: { fileId: id },
      include: {
        fromUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        toUser: {
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

  async evaluateSla() {
    const now = new Date();

    const client = this.prisma as any;

    const overdueFiles = await client.file.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          lt: now,
        },
        slaEscalations: {
          none: {
            resolvedAt: null,
          },
        },
      },
      include: {
        department: true,
      },
    });

    const escalations: any[] = [];

    for (const file of overdueFiles) {
      const deptHead = await this.prisma.user.findFirst({
        where: {
          departmentId: file.departmentId,
          role: 'DEPT_HEAD',
        },
      });

      if (!deptHead) {
        continue;
      }

      const escalation = await client.sLAEscalation.create({
        data: {
          fileId: file.id,
          escalatedTo: deptHead.id,
          reason: 'OVERDUE',
        },
      });

      escalations.push(escalation);
    }

    return {
      scanned: overdueFiles.length,
      escalated: escalations.length,
    };
  }
}

// Trigger rebuild
