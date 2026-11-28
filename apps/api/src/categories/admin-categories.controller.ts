import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/access.decorator';
import { PaginationQueryDto, paginationMeta, skipTake } from '../common/pagination/pagination.dto';
import { ApiMessage } from '../common/responses/response.interceptor';
import { CategoriesService } from './categories.service';

@ApiTags('Admin Categories')
@Controller('admin/categories')
@UseGuards(JwtAuthGuard)
@Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiMessage('Categories fetched successfully')
  async list(@Query() query: PaginationQueryDto, @Query('search') search?: string) {
    const { skip, take } = skipTake(query.page, query.limit);
    const { items, total } = await this.categories.listAdmin({ skip, take, search });
    return { data: items, meta: paginationMeta(query.page, query.limit, total) };
  }
}
