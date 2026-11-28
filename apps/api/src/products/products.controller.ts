import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProductStatus, RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/access.decorator';
import { Public } from '../common/decorators/public.decorator';
import { paginationMeta, skipTake } from '../common/pagination/pagination.dto';
import { ApiMessage } from '../common/responses/response.interceptor';
import {
  CreateProductDto,
  CreateProductImageDto,
  CreateVariantDto,
  ProductQueryDto,
  RelatedProductsDto,
  ReorderImagesDto,
  UpdateProductDto,
  UpdateProductImageDto,
  UpdateVariantDto,
} from './dto/product.dto';
import { ProductsService } from './products.service';

const CATALOGUE_ADMINS = [RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER] as const;

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @Public()
  @ApiMessage('Products fetched successfully')
  async list(@Query() query: ProductQueryDto) {
    const { skip, take } = skipTake(query.page, query.limit);
    const { items, total } = await this.products.list({
      skip,
      take,
      status: ProductStatus.ACTIVE,
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

  @Get(':slug')
  @Public()
  @ApiMessage('Product fetched successfully')
  get(@Param('slug') slug: string) {
    return this.products.findBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles(...CATALOGUE_ADMINS)
  @ApiMessage('Product created successfully')
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch(':slug')
  @UseGuards(JwtAuthGuard)
  @Roles(...CATALOGUE_ADMINS)
  @ApiMessage('Product updated successfully')
  update(@Param('slug') slug: string, @Body() dto: UpdateProductDto) {
    return this.products.update(slug, dto);
  }

  @Delete(':slug')
  @UseGuards(JwtAuthGuard)
  @Roles(...CATALOGUE_ADMINS)
  @ApiMessage('Product deleted successfully')
  async remove(@Param('slug') slug: string) {
    await this.products.remove(slug);
    return { deleted: true };
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard)
  @Roles(...CATALOGUE_ADMINS)
  @ApiMessage('Product image added successfully')
  addImage(@Param('id') id: string, @Body() dto: CreateProductImageDto) {
    return this.products.addImage(id, dto);
  }

  @Post(':id/images/reorder')
  @UseGuards(JwtAuthGuard)
  @Roles(...CATALOGUE_ADMINS)
  @ApiMessage('Product images reordered successfully')
  async reorderImages(@Param('id') id: string, @Body() dto: ReorderImagesDto) {
    await this.products.reorderImages(id, dto);
    return { updated: dto.items.length };
  }

  @Patch(':id/images/:imageId')
  @UseGuards(JwtAuthGuard)
  @Roles(...CATALOGUE_ADMINS)
  @ApiMessage('Product image updated successfully')
  updateImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Body() dto: UpdateProductImageDto,
  ) {
    return this.products.updateImage(id, imageId, dto);
  }

  @Delete(':id/images/:imageId')
  @UseGuards(JwtAuthGuard)
  @Roles(...CATALOGUE_ADMINS)
  @ApiMessage('Product image deleted successfully')
  async removeImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    await this.products.removeImage(id, imageId);
    return { deleted: true };
  }

  @Post(':id/variants')
  @UseGuards(JwtAuthGuard)
  @Roles(...CATALOGUE_ADMINS)
  @ApiMessage('Product variant created successfully')
  addVariant(@Param('id') id: string, @Body() dto: CreateVariantDto) {
    return this.products.addVariant(id, dto);
  }

  @Patch(':id/variants/:variantId')
  @UseGuards(JwtAuthGuard)
  @Roles(...CATALOGUE_ADMINS)
  @ApiMessage('Product variant updated successfully')
  updateVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.products.updateVariant(id, variantId, dto);
  }

  @Delete(':id/variants/:variantId')
  @UseGuards(JwtAuthGuard)
  @Roles(...CATALOGUE_ADMINS)
  @ApiMessage('Product variant deleted successfully')
  async removeVariant(@Param('id') id: string, @Param('variantId') variantId: string) {
    await this.products.removeVariant(id, variantId);
    return { deleted: true };
  }

  @Patch(':id/related')
  @UseGuards(JwtAuthGuard)
  @Roles(...CATALOGUE_ADMINS)
  @ApiMessage('Related products updated successfully')
  setRelated(@Param('id') id: string, @Body() dto: RelatedProductsDto) {
    return this.products.setRelated(id, dto.productIds);
  }
}
