import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/access.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ApiMessage } from '../common/responses/response.interceptor';
import { CategoriesService } from './categories.service';
import {
  CreateCategoryDto,
  ReorderCategoriesDto,
  UpdateCategoryDto,
} from './dto/category.dto';

const CATALOGUE_ADMINS = [RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER] as const;

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @Public()
  @ApiMessage('Categories fetched successfully')
  list() {
    return this.categories.listPublic();
  }

  @Get(':slug')
  @Public()
  @ApiMessage('Category fetched successfully')
  get(@Param('slug') slug: string) {
    return this.categories.findBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles(...CATALOGUE_ADMINS)
  @ApiMessage('Category created successfully')
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Post('reorder')
  @UseGuards(JwtAuthGuard)
  @Roles(...CATALOGUE_ADMINS)
  @ApiMessage('Category order updated successfully')
  async reorder(@Body() dto: ReorderCategoriesDto) {
    await this.categories.reorder(dto);
    return { updated: dto.items.length };
  }

  @Patch(':slug')
  @UseGuards(JwtAuthGuard)
  @Roles(...CATALOGUE_ADMINS)
  @ApiMessage('Category updated successfully')
  update(@Param('slug') slug: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(slug, dto);
  }

  @Delete(':slug')
  @UseGuards(JwtAuthGuard)
  @Roles(...CATALOGUE_ADMINS)
  @ApiMessage('Category deleted successfully')
  async remove(@Param('slug') slug: string) {
    await this.categories.remove(slug);
    return { deleted: true };
  }
}
