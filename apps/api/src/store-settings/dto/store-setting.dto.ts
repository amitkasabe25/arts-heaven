import { IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateStoreSettingDto {
  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9_.-]+$/)
  key!: string;

  @IsObject()
  value!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateStoreSettingDto {
  @IsOptional()
  @IsObject()
  value?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
