import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import type { Request } from 'express';
import { Env } from '../common/config/env.validation';
import { PrismaService } from '../common/prisma/prisma.service';
import { invalidToken } from './auth.errors';

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function parseTtl(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = match[2];
  const factor = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return amount * factor;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async signAccess(userId: string, email: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
      },
    );
  }

  async issueRefresh(userId: string, request?: Request): Promise<string> {
    const token = randomBytes(48).toString('hex');
    const ttl = parseTtl(this.config.get('JWT_REFRESH_TTL', { infer: true }));
    await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: hash(token),
        expiresAt: new Date(Date.now() + ttl),
        userAgent: request?.headers?.['user-agent'],
        ipAddress: request?.ip,
      },
    });
    return token;
  }

  async rotate(refreshToken: string, request?: Request): Promise<{ userId: string; refreshToken: string }> {
    const existing = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hash(refreshToken) },
    });
    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) throw invalidToken();

    const nextToken = await this.issueRefresh(existing.userId, request);
    const nextSession = await this.prisma.session.findUniqueOrThrow({
      where: { refreshTokenHash: hash(nextToken) },
    });
    await this.prisma.session.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedById: nextSession.id },
    });
    return { userId: existing.userId, refreshToken: nextToken };
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: hash(refreshToken) },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async createEmailVerificationToken(userId: string): Promise<string> {
    return this.createOneTimeToken('email', userId, 'JWT_EMAIL_VERIFY_SECRET');
  }

  async consumeEmailVerificationToken(token: string): Promise<string> {
    return this.consumeOneTimeToken(token, 'email');
  }

  async createPasswordResetToken(userId: string): Promise<string> {
    return this.createOneTimeToken('password', userId, 'JWT_PASSWORD_RESET_SECRET');
  }

  async consumePasswordResetToken(token: string): Promise<string> {
    return this.consumeOneTimeToken(token, 'password');
  }

  private async createOneTimeToken(
    purpose: 'email' | 'password',
    userId: string,
    _secretKey: 'JWT_EMAIL_VERIFY_SECRET' | 'JWT_PASSWORD_RESET_SECRET',
  ): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const data = {
      tokenHash: hash(token),
      userId,
      expiresAt: new Date(Date.now() + (purpose === 'email' ? 24 : 1) * 3600_000),
    };
    if (purpose === 'email') await this.prisma.emailVerificationToken.create({ data });
    else await this.prisma.passwordResetToken.create({ data });
    return token;
  }

  private async consumeOneTimeToken(
    token: string,
    purpose: 'email' | 'password',
  ): Promise<string> {
    const where = { tokenHash: hash(token) };
    const record =
      purpose === 'email'
        ? await this.prisma.emailVerificationToken.findUnique({ where })
        : await this.prisma.passwordResetToken.findUnique({ where });
    if (!record || record.usedAt || record.expiresAt < new Date()) throw invalidToken();

    if (purpose === 'email') {
      await this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
    } else {
      await this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
    }
    return record.userId;
  }

  /** Verifies a JWT and returns the user id; roles are always reloaded from the database. */
  async verifyAccess(token: string): Promise<string> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
      if (!payload.sub) throw new UnauthorizedException();
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
