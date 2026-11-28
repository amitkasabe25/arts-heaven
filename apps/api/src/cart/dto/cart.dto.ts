import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CustomizationValueDto {
  @IsString()
  fieldKey!: string;

  // Kept intentionally flexible: each schema field validates its own value type.
  value!: unknown;
}

export class AddCartItemDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  quantity!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  customizations?: CustomizationValueDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  uploadedAssetIds?: string[];
}

export class UpdateQuantityDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  quantity!: number;
}

export class MergeCartDto {
  @IsString()
  guestToken!: string;
}

export class SetCouponDto {
  @IsOptional()
  @IsString()
  code?: string;
}
