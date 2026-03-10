import { Test, TestingModule } from '@nestjs/testing';
import { RequestsService } from './requests.service';
import { PrismaService } from '../database/prisma.service';
import {
  RequestTypeEnum,
  PriorityLevelEnum,
  ConfidentialityLevelEnum,
  FileCategoryEnum,
} from './dto/create-request.dto';

describe('RequestsService', () => {
  let service: RequestsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    request: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    requestDocument: {
      create: jest.fn(),
    },
    requestActivity: {
      create: jest.fn(),
    },
    file: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<RequestsService>(RequestsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new request with user as creator', async () => {
      const createDto = {
        title: 'IT Support Request',
        description: 'Need help with email',
        requestType: RequestTypeEnum.IT_SUPPORT,
        priority: PriorityLevelEnum.NORMAL,
        confidentiality: ConfidentialityLevelEnum.INTERNAL,
        category: FileCategoryEnum.IT,
        requestorName: 'John Doe',
        requestorEmail: 'john@example.com',
      };

      const userId = 'user-123';

      const mockRequest = {
        id: 'req-1',
        ...createDto,
        status: 'SUBMITTED',
        createdById: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.request.create.mockResolvedValue(mockRequest);

      const result = await service.create(createDto, userId);

      expect(result).toEqual(mockRequest);
      expect(mockPrismaService.request.create).toHaveBeenCalled();
      const callArgs = mockPrismaService.request.create.mock.calls[0][0];
      expect(callArgs.data).toMatchObject({
        title: createDto.title,
        description: createDto.description,
        requestorName: createDto.requestorName,
        createdById: userId,
        status: 'SUBMITTED',
      });
    });
  });

  describe('convertToFile', () => {
    it('should convert request to file and link them', async () => {
      const requestId = 'req-1';
      const convertDto = {
        departmentId: 'dept-1',
        subject: 'File Subject',
        description: 'File Description',
      };

      const mockRequest = {
        id: requestId,
        title: 'Test Request',
        description: 'Test Description',
        requestType: 'IT_SUPPORT',
        priority: 'HIGH',
        confidentiality: 'CONFIDENTIAL',
        category: 'IT',
        status: 'PENDING',
      };

      const mockFile = {
        id: 'file-1',
        fileNumber: 'F-2026-0001',
        subject: convertDto.subject,
        description: convertDto.description,
        requestId: requestId,
        priority: mockRequest.priority,
        confidentiality: mockRequest.confidentiality,
        category: mockRequest.category,
      };

      mockPrismaService.request.findUnique.mockResolvedValue(mockRequest);
      mockPrismaService.file.findFirst.mockResolvedValue(null);
      mockPrismaService.file.create.mockResolvedValue(mockFile);
      mockPrismaService.requestActivity.create.mockResolvedValue({
        id: 'activity-1',
        requestId,
        action: 'CONVERTED_TO_FILE',
      });

      const result = await service.convertToFile(
        requestId,
        convertDto,
        'user-123',
      );

      expect(result).toEqual(mockFile);
      expect(mockPrismaService.file.create).toHaveBeenCalled();
      expect(mockPrismaService.requestActivity.create).toHaveBeenCalled();
    });

    it('should throw error if request not found', async () => {
      mockPrismaService.request.findUnique.mockResolvedValue(null);

      await expect(
        service.convertToFile(
          'non-existent',
          { departmentId: 'dept-1' },
          'user-123',
        ),
      ).rejects.toThrow('Request not found');
    });
  });

  describe('findAll', () => {
    it('should return list of requests', async () => {
      const mockRequests = [
        {
          id: 'req-1',
          requestNumber: 'REQ-2026-0001',
          title: 'Request 1',
          status: 'PENDING',
          createdBy: { id: 'user-1', username: 'user1' },
        },
        {
          id: 'req-2',
          requestNumber: 'REQ-2026-0002',
          title: 'Request 2',
          status: 'IN_PROGRESS',
          createdBy: { id: 'user-2', username: 'user2' },
        },
      ];

      mockPrismaService.request.findMany.mockResolvedValue(mockRequests);

      const result = await service.findAll({});

      expect(result).toEqual(mockRequests);
      expect(mockPrismaService.request.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });
  });
});
