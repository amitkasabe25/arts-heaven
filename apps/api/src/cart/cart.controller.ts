import {
  UnauthorizedException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OptionalAuthGuard } from '../auth/guards/optional-jwt.guard';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ApiMessage } from '../common/responses/response.interceptor';
import { CartService } from './cart.service';
import { AddCartItemDto, MergeCartDto, SetCouponDto, UpdateQuantityDto } from './dto/cart.dto';

@ApiTags('Cart')
@Controller('cart')
@Public()
@UseGuards(OptionalAuthGuard)
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @ApiMessage('Cart fetched successfully')
  async get(
    @CurrentUser() user: AuthUser | null,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    const cart = await this.cart.get(user?.id, guestToken);
    const items = await this.cart.listItems(cart.id);
    return { ...this.cart.summary({ items }), items, couponCode: cart.couponCode };
  }

  @Post('items')
  @ApiMessage('Item added to cart')
  add(
    @CurrentUser() user: AuthUser | null,
    @Headers('x-guest-token') guestToken: string | undefined,
    @Body() dto: AddCartItemDto,
  ) {
    return this.cart.add(user?.id, guestToken, dto);
  }

  @Patch('items/:id')
  @ApiMessage('Cart item updated')
  update(
    @CurrentUser() user: AuthUser | null,
    @Headers('x-guest-token') guestToken: string | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateQuantityDto,
  ) {
    return this.cart.updateQuantity(user?.id, guestToken, id, dto.quantity);
  }

  @Delete('items/:id')
  @ApiMessage('Cart item removed')
  remove(
    @CurrentUser() user: AuthUser | null,
    @Headers('x-guest-token') guestToken: string | undefined,
    @Param('id') id: string,
  ) {
    return this.cart.remove(user?.id, guestToken, id);
  }

  @Patch('coupon')
  @ApiMessage('Cart coupon updated')
  setCoupon(
    @CurrentUser() user: AuthUser | null,
    @Headers('x-guest-token') guestToken: string | undefined,
    @Body() dto: SetCouponDto,
  ) {
    return this.cart.setCoupon(user?.id, guestToken, dto.code ?? null);
  }

  @Post('merge')
  @ApiMessage('Guest cart merged')
  merge(@CurrentUser() user: AuthUser | null, @Body() dto: MergeCartDto) {
    if (!user) throw new UnauthorizedException('Authentication required to merge a cart');
    return this.cart.merge(user.id, dto.guestToken);
  }

  @Delete()
  @ApiMessage('Cart cleared')
  clear(
    @CurrentUser() user: AuthUser | null,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    return this.cart.clear(user?.id, guestToken).then(() => ({ cleared: true }));
  }
}
