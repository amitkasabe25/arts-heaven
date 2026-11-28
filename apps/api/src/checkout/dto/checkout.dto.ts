import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaymentProvider } from '@prisma/client';

export class CheckoutQuoteDto {
  @IsOptional() @IsString() addressId?: string;
  @IsOptional() @IsString() @Matches(/^[1-9]\d{5}$/) pincode?: string;
  @IsOptional() @IsDateString() deliveryDate?: string;
  @IsOptional() @IsString() slotId?: string;
  @IsOptional() @IsString() giftWrapId?: string;
  @IsOptional() @IsString() couponCode?: string;
}

export class PlaceOrderDto extends CheckoutQuoteDto {
  @IsOptional() @IsEmail() customerEmail?: string;
  @IsOptional() @IsString() @Matches(/^[6-9]\d{9}$/) customerPhone?: string;
  @IsOptional() @IsString() @MinLength(2) recipientName?: string;
  @IsOptional() @IsString() @Matches(/^[6-9]\d{9}$/) recipientPhone?: string;
  @IsOptional() @IsString() @MinLength(8) addressLine?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() @MaxLength(200) cardMessage?: string;
  @IsEnum(PaymentProvider) paymentProvider!: PaymentProvider;
}
