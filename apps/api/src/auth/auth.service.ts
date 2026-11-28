import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { Request } from 'express';
import { RoleName } from '@prisma/client';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { invalidCredentials } from './auth.errors';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { RegisterDto } from './dto/register.dto';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    @Inject('NOTIFICATION_QUEUE') private readonly notificationQueue: Queue,
  ) {}

  async register(input: RegisterDto, request?: Request) {
    const user = await this.users.createCustomer(input);
    const token = await this.tokens.createEmailVerificationToken(user.id);
    await this.enqueue('EMAIL_VERIFICATION', {
      email: user.email,
      name: user.name,
      token,
    });
    return { userId: user.id, email: user.email };
  }

  async login(input: LoginDto, request?: Request, staffOnly = false) {
    const user = await this.users.findByEmail(input.email);
    if (!user || !(await this.users.verifyPassword(input.password, user.passwordHash)))
      throw invalidCredentials();
    if (!user.isActive) throw new UnauthorizedException('This account is disabled');

    const access = await this.tokens.signAccess(user.id, user.email);
    const refresh = await this.tokens.issueRefresh(user.id, request);
    const accessInfo = await this.users.findWithAccess(user.id);
    const roles = accessInfo?.roles.map((role) => role.name) ?? [];
    const permissions = [...new Set(accessInfo?.roles.flatMap((role) => role.permissions.map((p) => p.key)) ?? [])];

    if (staffOnly && !roles.some((role) => role !== RoleName.CUSTOMER))
      throw new UnauthorizedException('Administrator access required');

    return {
      accessToken: access,
      refreshToken: refresh,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        roles,
        permissions,
        emailVerified: !!user.emailVerifiedAt,
      },
    };
  }

  async refresh(refreshToken: string, request?: Request) {
    const rotated = await this.tokens.rotate(refreshToken, request);
    const user = await this.users.findById(rotated.userId);
    if (!user || !user.isActive) throw invalidCredentials();
    return {
      accessToken: await this.tokens.signAccess(user.id, user.email),
      refreshToken: rotated.refreshToken,
      tokenType: 'Bearer',
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }

  async verifyEmail(token: string) {
    const userId = await this.tokens.consumeEmailVerificationToken(token);
    await this.users.markEmailVerified(userId);
    return { verified: true };
  }

  async forgotPassword(input: ForgotPasswordDto) {
    const user = await this.users.findByEmail(input.email);
    // Do not disclose whether the email exists.
    if (!user) return { accepted: true };
    const token = await this.tokens.createPasswordResetToken(user.id);
    await this.enqueue('PASSWORD_RESET', { email: user.email, name: user.name, token });
    return { accepted: true };
  }

  async resetPassword(input: ResetPasswordDto) {
    const userId = await this.tokens.consumePasswordResetToken(input.token);
    const user = await this.users.findById(userId);
    if (!user) throw invalidCredentials();
    await this.prismaChangePassword(userId, input.password);
    await this.tokens.revokeAllForUser(userId);
    return { reset: true };
  }

  async changePassword(userId: string, input: ChangePasswordDto) {
    await this.users.changePassword(userId, input.currentPassword, input.newPassword);
    return { changed: true };
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.users.findWithAccess(userId);
    if (!user) throw invalidCredentials();
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles.map((role) => role.name),
      permissions: [...new Set(user.roles.flatMap((role) => role.permissions.map((p) => p.key)))],
    };
  }

  private async prismaChangePassword(userId: string, password: string): Promise<void> {
    const hash = await this.users.hashPassword(password);
    await this.users.adminSetPasswordHash(userId, hash);
  }

  private async enqueue(eventType: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await this.notificationQueue.add('send', { eventType, channel: 'EMAIL', ...payload });
    } catch (error) {
      // Queue availability must not block registration; a scheduled retry reconciles it.
      this.logger.warn(`Could not enqueue ${eventType}: ${(error as Error).message}`);
    }
  }
}
