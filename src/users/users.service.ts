import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto, currentUser?: any) {
    // If Dept Head, enforce scope
    if (currentUser && currentUser.role === 'DEPT_HEAD') {
      if (createUserDto.role === 'ADMIN') {
        throw new ConflictException('Department Heads cannot create Admins');
      }

      // If departmentId is in payload, it MUST match
      if (
        createUserDto.departmentId &&
        createUserDto.departmentId !== currentUser.departmentId
      ) {
        throw new ConflictException(
          'You can only create users in your own department',
        );
      }

      // If departmentId is NOT in payload, set it
      if (!createUserDto.departmentId) {
        createUserDto.departmentId = currentUser.departmentId;
      }
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
        // Safety net: if not set by above logic (e.g. Admin), it stays as is.
        // If Dept Head, it's already set in createUserDto or we ensured it.
        // Actually, earlier logic handles it.
        departmentId:
          currentUser && currentUser.role === 'DEPT_HEAD'
            ? currentUser.departmentId
            : createUserDto.departmentId,
      },
      include: { department: true },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  async findAll(currentUser?: any, directoryMode = false) {
    const where: any = {};
    // If Dept Head, enforce scope UNLESS directory mode is requested (for workflow/return actions)
    if (currentUser && currentUser.role === 'DEPT_HEAD' && !directoryMode) {
      where.departmentId = currentUser.departmentId;
    }

    const users = await this.prisma.user.findMany({
      where,
      include: { department: true },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = user;
      return result;
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { department: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { department: true },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto, currentUser?: any) {
    const userToUpdate = await this.findOne(id);

    // If Dept Head, enforce scope
    if (currentUser && currentUser.role === 'DEPT_HEAD') {
      if (userToUpdate.departmentId !== currentUser.departmentId) {
        throw new ConflictException(
          'You can only update users in your own department',
        );
      }
      if (userToUpdate.role === 'ADMIN' || userToUpdate.role === 'DEPT_HEAD') {
        // Prevent editing other Dept Heads or Admins?
        // Allow editing self if needed, but usually profile update is separate.
        // For now, prevent editing other high ranking officials.
        if (userToUpdate.id !== currentUser.id) {
          throw new ConflictException(
            'You cannot modify other Department Heads or Admins',
          );
        }
      }
      // Prevent changing department
      if (
        updateUserDto.departmentId &&
        updateUserDto.departmentId !== currentUser.departmentId
      ) {
        throw new ConflictException(
          'You cannot change the department of a user',
        );
      }
    }

    const data: any = { ...updateUserDto };
    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      include: { department: true },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  async updateStatus(id: string, status: string, currentUser?: any) {
    const userToUpdate = await this.findOne(id);

    // If Dept Head, enforce scope
    if (currentUser && currentUser.role === 'DEPT_HEAD') {
      if (userToUpdate.departmentId !== currentUser.departmentId) {
        throw new ConflictException(
          'You can only update users in your own department',
        );
      }
      if (userToUpdate.role === 'ADMIN' || userToUpdate.role === 'DEPT_HEAD') {
        if (userToUpdate.id !== currentUser.id) {
          throw new ConflictException(
            'You cannot modify other Department Heads or Admins',
          );
        }
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { status: status as any },
      include: { department: true },
    });

    const { password, ...result } = user as any;
    return result;
  }

  async remove(id: string, currentUser?: any) {
    const userToDelete = await this.prisma.user.findUnique({
      where: { id },
      include: {
        department: true,
        _count: {
          select: {
            createdFiles: true,
            ownedFiles: true,
            sentMovements: true,
            receivedMovements: true,
          },
        },
      },
    });

    if (!userToDelete) {
      throw new NotFoundException('User not found');
    }

    if (currentUser && currentUser.role === 'DEPT_HEAD') {
      if (userToDelete.departmentId !== currentUser.departmentId) {
        throw new ConflictException(
          'You can only delete users in your own department',
        );
      }
      if (userToDelete.role === 'ADMIN' || userToDelete.role === 'DEPT_HEAD') {
        throw new ConflictException(
          'You cannot delete other Department Heads or Admins',
        );
      }
    }

    if (
      userToDelete._count.createdFiles > 0 ||
      userToDelete._count.ownedFiles > 0 ||
      userToDelete._count.sentMovements > 0 ||
      userToDelete._count.receivedMovements > 0
    ) {
      const reasons = [];
      if (userToDelete._count.ownedFiles > 0)
        reasons.push(`currently own ${userToDelete._count.ownedFiles} files`);
      if (userToDelete._count.createdFiles > 0)
        reasons.push(`created ${userToDelete._count.createdFiles} files`);
      if (
        userToDelete._count.sentMovements > 0 ||
        userToDelete._count.receivedMovements > 0
      )
        reasons.push(
          `are part of ${userToDelete._count.sentMovements + userToDelete._count.receivedMovements} file movements`,
        );

      throw new ConflictException(
        `Cannot delete user because they ${reasons.join(', ')}. Please reassign their files or deactivate the account instead.`,
      );
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully' };
  }
}
