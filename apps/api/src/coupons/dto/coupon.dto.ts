import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { CouponType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateCouponDto {
  @IsString()
  @MaxLength(40)
  code!: string;

  @IsEnum(CouponType)
  type!: CouponType;

  @Type(() => Number)
  @Min(0)
  value!: number;

  @IsOptional() @Type(() => Number) @Min(0) minSubtotal?: number;
  @IsOptional() @Type(() => Number) @Min(0) maxDiscount?: number;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) usageLimit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) perCustomerLimit?: number;
  @IsOptional() @IsBoolean() firstOrderOnly?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() description?: string;
}

export class UpdateCouponDto {
  @IsOptional() @IsEnum(CouponType) type?: CouponType;
  @IsOptional() @Type(() => Number) @Min(0) value?: number;
  @IsOptional() @Type(() => Number) @Min(0) minSubtotal?: number;
  @IsOptional() @Type(() => Number) @Min(0) maxDiscount?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsString() description?: string;
}

export class ValidateCouponDto {
  @IsString()
  code!: string;

  @IsOptional() @Type(() => Number) @Min(0) subtotal?: number;
}
