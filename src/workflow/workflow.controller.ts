import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Put,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import {
  CreateCategoryDto,
  CreateStageDto,
  ApprovalActionDto,
} from './dto/workflow.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('workflow')
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  // --- Categories ---
  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.workflowService.createCategory(dto);
  }

  @Get('categories')
  listCategories() {
    return this.workflowService.listCategories();
  }

  @Get('categories/:id')
  getCategory(@Param('id') id: string) {
    return this.workflowService.getCategory(id);
  }

  // --- Stages ---
  @Post('stages')
  addStage(@Body() dto: CreateStageDto) {
    return this.workflowService.addStage(dto);
  }

  @Delete('stages/:id')
  removeStage(@Param('id') id: string) {
    return this.workflowService.removeStage(id);
  }

  // --- Approvals ---
  @Get('files/:fileId/approvals')
  getFileApprovals(@Param('fileId') fileId: string) {
    return this.workflowService.getFileApprovals(fileId);
  }

  @Post('files/:fileId/action')
  processAction(
    @Param('fileId') fileId: string,
    @Body() dto: ApprovalActionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.workflowService.processApproval(fileId, userId, dto);
  }
}
