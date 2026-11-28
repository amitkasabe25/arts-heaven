import { UnauthorizedException } from '@nestjs/common';

export const invalidCredentials = () => new UnauthorizedException('Invalid email or password');
export const invalidToken = () => new UnauthorizedException('Invalid or expired token');
export const inactiveAccount = () => new UnauthorizedException('This account is disabled');
