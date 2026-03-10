import { Test, TestingModule } from '@nestjs/testing';
import { FilesService } from './files.service';
import { PrismaService } from '../database/prisma.service';
import { WorkflowService } from '../workflow/workflow.service';
import { ClassificationsService } from '../classifications/classifications.service';

describe('FilesService', () => {
  let service: FilesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    file: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    fileNumberingConfig: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    sLAEscalation: {
      create: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  };

  const mockWorkflowService = {
    autoRoute: jest.fn(),
  };

  const mockClassificationsService = {
    findRouteForFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: WorkflowService,
          useValue: mockWorkflowService,
        },
        {
          provide: ClassificationsService,
          useValue: mockClassificationsService,
        },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create with SLA', () => {
    it('should calculate dueDate from slaHours when provided', async () => {
      const createDto = {
        subject: 'Test File',
        description: 'Test Description',
        departmentId: 'dept-1',
        slaHours: 24,
      };

      const userId = 'user-123';

      // Mock file numbering config
      mockPrismaService.fileNumberingConfig.findUnique.mockResolvedValue(null);
      mockPrismaService.file.findFirst.mockResolvedValue(null);

      const mockFile = {
        id: 'file-1',
        fileNumber: 'F-2026-0001',
        subject: createDto.subject,
        dueDate: expect.any(Date),
        slaHours: 24,
      };

      mockPrismaService.file.create.mockResolvedValue(mockFile);

      const result = await service.create(createDto as any, userId);

      expect(result).toEqual(mockFile);
      expect(mockPrismaService.file.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subject: createDto.subject,
            slaHours: 24,
            dueDate: expect.any(Date),
          }),
        }),
      );
    });

    it('should use provided dueDate when slaHours is not provided', async () => {
      const dueDate = new Date('2026-03-01');
      const createDto = {
        subject: 'Test File',
        description: 'Test Description',
        departmentId: 'dept-1',
        dueDate: dueDate.toISOString(),
      };

      const userId = 'user-123';

      mockPrismaService.fileNumberingConfig.findUnique.mockResolvedValue(null);
      mockPrismaService.file.findFirst.mockResolvedValue(null);

      const mockFile = {
        id: 'file-1',
        fileNumber: 'F-2026-0001',
        subject: createDto.subject,
        dueDate: dueDate,
      };

      mockPrismaService.file.create.mockResolvedValue(mockFile);

      const result = await service.create(createDto as any, userId);

      expect(result).toEqual(mockFile);
    });
  });

  describe('evaluateSla', () => {
    it('should create escalations for overdue files without existing escalations', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const overdueFiles = [
        {
          id: 'file-1',
          fileNumber: 'F-2026-0001',
          subject: 'Overdue File 1',
          status: 'PENDING',
          dueDate: yesterday,
          departmentId: 'dept-1',
          department: { id: 'dept-1', name: 'IT' },
        },
        {
          id: 'file-2',
          fileNumber: 'F-2026-0002',
          subject: 'Overdue File 2',
          status: 'PENDING',
          dueDate: yesterday,
          departmentId: 'dept-2',
          department: { id: 'dept-2', name: 'HR' },
        },
      ];

      const deptHeads = [
        { id: 'head-1', role: 'DEPT_HEAD', departmentId: 'dept-1' },
        { id: 'head-2', role: 'DEPT_HEAD', departmentId: 'dept-2' },
      ];

      // Mock Prisma client methods using 'as any' approach from actual service
      (mockPrismaService as any).file.findMany = jest
        .fn()
        .mockResolvedValue(overdueFiles);

      mockPrismaService.user.findFirst
        .mockResolvedValueOnce(deptHeads[0])
        .mockResolvedValueOnce(deptHeads[1]);

      (mockPrismaService as any).sLAEscalation = {
        create: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'esc-1',
            fileId: 'file-1',
            escalatedTo: 'head-1',
            reason: 'OVERDUE',
          })
          .mockResolvedValueOnce({
            id: 'esc-2',
            fileId: 'file-2',
            escalatedTo: 'head-2',
            reason: 'OVERDUE',
          }),
      };

      const result = await service.evaluateSla();

      expect(result.scanned).toBe(2);
      expect(result.escalated).toBe(2);
    });

    it('should return zero escalations when no overdue files', async () => {
      (mockPrismaService as any).file.findMany = jest
        .fn()
        .mockResolvedValue([]);

      const result = await service.evaluateSla();

      expect(result.scanned).toBe(0);
      expect(result.escalated).toBe(0);
    });
  });
});
