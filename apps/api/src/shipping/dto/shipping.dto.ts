import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateDeliveryZoneDto {
  @IsString() name!: string;
  @IsArray() @IsString({ each: true }) pincodePrefixes!: string[];
  @Type(() => Number) @Min(0) deliveryFee!: number;
  @IsOptional() @Type(() => Number) @Min(0) freeAbove?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) estimatedDaysMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) estimatedDaysMax?: number;
  @IsOptional() @IsBoolean() sameDayEligible?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateDeliveryZoneDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) pincodePrefixes?: string[];
  @IsOptional() @Type(() => Number) @Min(0) deliveryFee?: number;
  @IsOptional() @Type(() => Number) @Min(0) freeAbove?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) estimatedDaysMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) estimatedDaysMax?: number;
  @IsOptional() @IsBoolean() sameDayEligible?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateDeliverySlotDto {
  @IsString() code!: string;
  @IsString() label!: string;
  @IsString() windowText!: string;
  @Type(() => Number) @Min(0) fee?: number;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateGiftWrapDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @Type(() => Number) @Min(0) price!: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
