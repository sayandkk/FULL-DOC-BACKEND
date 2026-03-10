import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics (KPI cards)' })
  getStats(@CurrentUser() user: any) {
    return this.dashboardService.getStats(user);
  }

  @Get('recent-files')
  @ApiOperation({ summary: 'Get recent file activity' })
  getRecentFiles(@CurrentUser() user: any, @Query('limit') limit?: string) {
    return this.dashboardService.getRecentFiles(
      user,
      limit ? parseInt(limit, 10) : 5,
    );
  }

  @Get('pending-actions')
  @ApiOperation({ summary: 'Get pending actions for current user' })
  getPendingActions(@CurrentUser('id') userId: string) {
    return this.dashboardService.getPendingActions(userId);
  }

  @Get('weekly-stats')
  @ApiOperation({ summary: 'Get weekly statistics' })
  getWeeklyStats(@CurrentUser() user: any) {
    // Backwards compatibility: compute basic weekly stats from workflow and movements
    return this.dashboardService.getWorkflowStats(user);
  }

  @Get('workflow-stats')
  @ApiOperation({ summary: 'Get workflow stage statistics (bottlenecks)' })
  getWorkflowStats(@CurrentUser() user: any) {
    return this.dashboardService.getWorkflowStats(user);
  }
}
