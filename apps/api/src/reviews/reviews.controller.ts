import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/access.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { PaginationQueryDto, paginationMeta } from '../common/pagination/pagination.dto';
import { ApiMessage } from '../common/responses/response.interceptor';
import { CreateReviewDto, ListReviewsQueryDto, ModerateReviewDto } from './dto/review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('products/:slug/reviews')
  @Public()
  @ApiMessage('Reviews fetched successfully')
  async listForProduct(@Param('slug') slug: string, @Query() query: PaginationQueryDto) {
    const { items, total } = await this.reviews.listForProduct(slug, query);
    return { data: items, meta: paginationMeta(query.page, query.limit, total) };
  }

  @Post('products/:slug/reviews')
  @UseGuards(JwtAuthGuard)
  @ApiMessage('Review submitted for moderation')
  create(
    @Param('slug') slug: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reviews.create(user.id, slug, dto);
  }

  @Get('reviews/me')
  @UseGuards(JwtAuthGuard)
  @ApiMessage('Your reviews fetched successfully')
  async mine(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    const { items, total } = await this.reviews.listMine(user.id, query);
    return { data: items, meta: paginationMeta(query.page, query.limit, total) };
  }

  @Get('admin/reviews')
  @UseGuards(JwtAuthGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Reviews fetched successfully')
  async adminList(@Query() query: ListReviewsQueryDto) {
    const { items, total } = await this.reviews.listForAdmin(query);
    return { data: items, meta: paginationMeta(query.page, query.limit, total) };
  }

  @Patch('admin/reviews/:id')
  @UseGuards(JwtAuthGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Review moderation status updated')
  moderate(@Param('id') id: string, @Body() dto: ModerateReviewDto) {
    return this.reviews.moderate(id, dto.status);
  }
}
