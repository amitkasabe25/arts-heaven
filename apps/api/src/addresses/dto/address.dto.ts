import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  label!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @Matches(/^[6-9]\d{9}$/)
  phone!: string;

  @IsString()
  @MinLength(8)
  addressLine!: string;

  @IsString()
  city!: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsString()
  @Matches(/^[1-9]\d{5}$/)
  pincode!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto {
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() @Matches(/^[6-9]\d{9}$/) phone?: string;
  @IsOptional() @IsString() @MinLength(8) addressLine?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() @Matches(/^[1-9]\d{5}$/) pincode?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
