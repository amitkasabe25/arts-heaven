import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/access.decorator';
import { paginationMeta, skipTake } from '../common/pagination/pagination.dto';
import { ApiMessage } from '../common/responses/response.interceptor';
import { ProductQueryDto } from './dto/product.dto';
import { ProductsService } from './products.service';

@ApiTags('Admin Products')
@Controller('admin/products')
@UseGuards(JwtAuthGuard)
@Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiMessage('Products fetched successfully')
  async list(@Query() query: ProductQueryDto) {
    const { skip, take } = skipTake(query.page, query.limit);
    const { items, total } = await this.products.list({
      skip,
      take,
      status: query.status,
      categorySlug: query.category,
      search: query.search,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      isFeatured: query.isFeatured,
      isBestSeller: query.isBestSeller,
      sortBy: query.sortBy,
      order: query.order,
    });
    return { data: items, meta: paginationMeta(query.page, query.limit, total) };
  }
}
