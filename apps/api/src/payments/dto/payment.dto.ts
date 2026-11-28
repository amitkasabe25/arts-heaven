import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaymentProvider } from '@prisma/client';

export class CreatePaymentDto {
  @IsString()
  orderNumber!: string;

  @IsEnum(PaymentProvider)
  provider!: PaymentProvider;
}

export class VerifyPaymentDto {
  @IsEnum(PaymentProvider)
  provider!: PaymentProvider;

  @IsString()
  providerOrderId!: string;

  @IsOptional()
  @IsString()
  providerPaymentId?: string;

  @IsOptional()
  @IsString()
  signature?: string;
}

export class RefundPaymentDto {
  /** Amount in rupees (major units). Defaults to the full captured amount. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount?: number;

  @IsString()
  reason!: string;

  @IsString()
  idempotencyKey!: string;
}
