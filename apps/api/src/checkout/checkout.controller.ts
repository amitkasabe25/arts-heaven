import {
  Body,
  Controller,
  Headers,
  Post,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OptionalAuthGuard } from '../auth/guards/optional-jwt.guard';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ApiMessage } from '../common/responses/response.interceptor';
import { CheckoutService } from './checkout.service';
import { CheckoutQuoteDto, PlaceOrderDto } from './dto/checkout.dto';

@ApiTags('Checkout')
@Controller('checkout')
@Public()
@UseGuards(OptionalAuthGuard)
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post('quote')
  @ApiMessage('Checkout quote calculated')
  quote(
    @CurrentUser() user: AuthUser | null,
    @Headers('x-guest-token') guestToken: string | undefined,
    @Body() dto: CheckoutQuoteDto,
  ) {
    return this.checkout.quoteJson(user?.id, guestToken, dto);
  }

  @Post('place')
  @ApiMessage('Order placed successfully')
  place(
    @CurrentUser() user: AuthUser | null,
    @Headers('x-guest-token') guestToken: string | undefined,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: PlaceOrderDto,
  ) {
    if (!user && !guestToken)
      throw new BadRequestException('A guest token or sign-in is required to place an order');
    return this.checkout.place(user?.id, guestToken, dto, idempotencyKey);
  }
}
