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
import { Throttle } from '@nestjs/throttler';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/access.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ApiMessage } from '../common/responses/response.interceptor';
import { PaginationQueryDto, paginationMeta, skipTake } from '../common/pagination/pagination.dto';
import { decimal, number } from '../common/utils/money.util';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './dto/coupon.dto';

@ApiTags('Coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Public()
  @Post('validate')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiMessage('Coupon validated')
  async validate(@Body() dto: ValidateCouponDto) {
    const quote = await this.coupons.validate(dto.code, decimal(dto.subtotal ?? 0));
    return { code: quote.coupon.code, discount: number(quote.discount), description: quote.description };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Coupons fetched successfully')
  async list(@Query() query: PaginationQueryDto) {
    const [items, total] = await this.coupons.list(skipTake(query.page, query.limit).skip, skipTake(query.page, query.limit).take);
    return { data: items, meta: paginationMeta(query.page, query.limit, total) };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Coupon created successfully')
  create(@Body() dto: CreateCouponDto) {
    return this.coupons.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Coupon updated successfully')
  update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.coupons.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Coupon deleted successfully')
  async remove(@Param('id') id: string) {
    await this.coupons.remove(id);
    return { deleted: true };
  }
}
