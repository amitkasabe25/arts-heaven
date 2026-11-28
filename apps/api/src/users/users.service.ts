import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, RoleName, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Env } from '../common/config/env.validation';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegisterDto } from '../auth/dto/register.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.get('BCRYPT_ROUNDS', { infer: true }));
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findWithAccess(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isActive: true,
        emailVerifiedAt: true,
        roles: { select: { name: true, permissions: { select: { key: true } } } },
      },
    });
  }

  async createCustomer(input: RegisterDto): Promise<User> {
    const email = input.email.toLowerCase().trim();
    if (await this.findByEmail(email)) throw new ConflictException('Email is already registered');

    const customerRole = await this.prisma.role.findUnique({
      where: { name: RoleName.CUSTOMER },
    });
    if (!customerRole) throw new ConflictException('Customer role is not configured');

    return this.prisma.user.create({
      data: {
        email,
        name: input.name.trim(),
        phone: input.phone,
        passwordHash: await this.hashPassword(input.password),
        roles: { connect: { id: customerRole.id } },
      },
    });
  }

  async createStaff(input: {
    email: string;
    name: string;
    password: string;
    roles: RoleName[];
  }): Promise<User> {
    if (await this.findByEmail(input.email)) throw new ConflictException('Email is already registered');
    return this.prisma.user.create({
      data: {
        email: input.email.toLowerCase().trim(),
        name: input.name.trim(),
        passwordHash: await this.hashPassword(input.password),
        roles: { connect: input.roles.map((name) => ({ name })) },
      },
    });
  }

  async list(params: { skip: number; take: number; search?: string }) {
    const where: Prisma.UserWhereInput = params.search
      ? {
          OR: [
            { name: { contains: params.search, mode: 'insensitive' } },
            { email: { contains: params.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          isActive: true,
          emailVerifiedAt: true,
          createdAt: true,
          roles: { select: { name: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total };
  }

  async setActive(id: string, isActive: boolean): Promise<User> {
    await this.findByIdOrThrow(id);
    return this.prisma.user.update({ where: { id }, data: { isActive } });
  }

  async updateProfile(
    id: string,
    data: Partial<Pick<User, 'name' | 'phone'>>,
  ): Promise<User> {
    await this.findByIdOrThrow(id);
    return this.prisma.user.update({ where: { id }, data });
  }

  async changePassword(id: string, current: string, next: string): Promise<void> {
    const user = await this.findByIdOrThrow(id);
    if (!(await this.verifyPassword(current, user.passwordHash)))
      throw new ConflictException('Current password is incorrect');
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await this.hashPassword(next) },
    });
    await this.prisma.session.updateMany({ where: { userId: id }, data: { revokedAt: new Date() } });
  }

  async adminSetPasswordHash(userId: string, hash: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  private async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
