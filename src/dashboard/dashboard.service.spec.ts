import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../database/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: PrismaService;

  const mockPrismaService = {
    file: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    inward: {
      count: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    sLAEscalation: {
      count: jest.fn(),
    },
    workflowStage: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStats', () => {
    it('should return comprehensive stats including SLA metrics', async () => {
      const userId = 'user-123';
      const now = new Date();

      // Mock all count calls
      mockPrismaService.file.count
        .mockResolvedValueOnce(10) // pendingFiles
        .mockResolvedValueOnce(25) // approvedFiles
        .mockResolvedValueOnce(3) // returnedFiles
        .mockResolvedValueOnce(50) // archivedFiles
        .mockResolvedValueOnce(5) // myPendingFiles
        .mockResolvedValueOnce(15); // myFiles

      mockPrismaService.inward.count.mockResolvedValue(100);
      mockPrismaService.user.count.mockResolvedValue(20);

      // Mock overdue files and SLA escalations using 'as any' approach
      (mockPrismaService as any).file.count = jest
        .fn()
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(25)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(15)
        .mockResolvedValueOnce(7); // overdueFiles

      (mockPrismaService as any).sLAEscalation = {
        count: jest.fn().mockResolvedValue(4), // open escalations
      };

      const result = await service.getStats(userId);

      expect(result).toEqual({
        overview: {
          pendingFiles: 10,
          approvedFiles: 25,
          returnedFiles: 3,
          archivedFiles: 50,
          totalInwards: 100,
          totalUsers: 20,
          overdueFiles: 7,
          slaEscalationsOpen: 4,
        },
        personal: {
          myPendingFiles: 5,
          myFiles: 15,
        },
      });
    });
  });

  describe('getWorkflowStats', () => {
    it('should return workflow stage statistics with bottleneck metrics', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      const mockStages = [
        {
          id: 'stage-1',
          stageOrder: 1,
          role: 'CLERK',
          categoryId: 'cat-1',
          category: { name: 'Finance' },
          currentFiles: [
            { id: 'file-1', createdAt: oneDayAgo },
            { id: 'file-2', createdAt: twoDaysAgo },
          ],
        },
        {
          id: 'stage-2',
          stageOrder: 2,
          role: 'DEPT_HEAD',
          categoryId: 'cat-1',
          category: { name: 'Finance' },
          currentFiles: [{ id: 'file-3', createdAt: oneDayAgo }],
        },
        {
          id: 'stage-3',
          stageOrder: 1,
          role: 'CLERK',
          categoryId: 'cat-2',
          category: { name: 'HR' },
          currentFiles: [],
        },
      ];

      (mockPrismaService as any).workflowStage = {
        findMany: jest.fn().mockResolvedValue(mockStages),
      };

      const result = await service.getWorkflowStats();

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        stageId: 'stage-1',
        stageOrder: 1,
        role: 'CLERK',
        categoryId: 'cat-1',
        categoryName: 'Finance',
        pendingCount: 2,
      });
      expect(result[0].avgAgeHours).toBeGreaterThan(24); // Average of 1 and 2 days

      expect(result[1]).toMatchObject({
        stageId: 'stage-2',
        stageOrder: 2,
        role: 'DEPT_HEAD',
        categoryId: 'cat-1',
        categoryName: 'Finance',
        pendingCount: 1,
      });
      expect(result[1].avgAgeHours).toBeGreaterThan(20); // Approximately 24 hours

      expect(result[2]).toMatchObject({
        stageId: 'stage-3',
        stageOrder: 1,
        role: 'CLERK',
        categoryId: 'cat-2',
        categoryName: 'HR',
        pendingCount: 0,
        avgAgeHours: 0,
      });
    });

    it('should handle empty workflow stages', async () => {
      (mockPrismaService as any).workflowStage = {
        findMany: jest.fn().mockResolvedValue([]),
      };

      const result = await service.getWorkflowStats();

      expect(result).toEqual([]);
    });
  });

  describe('getRecentFiles', () => {
    it('should return recent files with specified limit', async () => {
      const mockFiles = [
        {
          id: 'file-1',
          fileNumber: 'F-2026-0001',
          subject: 'Recent File 1',
          status: 'PENDING',
        },
        {
          id: 'file-2',
          fileNumber: 'F-2026-0002',
          subject: 'Recent File 2',
          status: 'APPROVED',
        },
      ];

      mockPrismaService.file.findMany.mockResolvedValue(mockFiles);

      const result = await service.getRecentFiles(5);

      expect(result).toEqual(mockFiles);
      expect(mockPrismaService.file.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: expect.any(Object),
      });
    });
  });
});
