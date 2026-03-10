import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.ADMIN, Role.DEPT_HEAD)
  @ApiOperation({ summary: 'Create a new user (Admin & Dept Head)' })
  create(@Body() createUserDto: CreateUserDto, @CurrentUser() user: any) {
    return this.usersService.create(createUserDto, user);
  }

  @Get()
  @ApiOperation({
    summary:
      'Get all users (Department scoped for Dept Head, unless directory=true)',
  })
  findAll(@CurrentUser() user: any, @Query('directory') directory?: string) {
    return this.usersService.findAll(user, directory === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.DEPT_HEAD)
  @ApiOperation({ summary: 'Update user (Admin & Dept Head)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.update(id, updateUserDto, user);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.DEPT_HEAD)
  @ApiOperation({ summary: 'Update user status' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: any,
    @CurrentUser() user: any,
  ) {
    return this.usersService.updateStatus(id, status, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.DEPT_HEAD)
  @ApiOperation({ summary: 'Delete user (Admin & Dept Head)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.usersService.remove(id, user);
  }
}
