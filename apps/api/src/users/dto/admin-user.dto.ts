import { IsArray, IsBoolean, IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { RoleName } from '@prisma/client';

export class CreateStaffDto {
  @IsEmail()
  email!: string;

  @IsString()
  name!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsArray()
  @IsEnum(RoleName, { each: true })
  roles!: RoleName[];
}

export class SetActiveDto {
  @IsBoolean()
  isActive!: boolean;
}

export class UpdateProfileDto {
  @IsString()
  name?: string;

  @IsString()
  phone?: string;
}
