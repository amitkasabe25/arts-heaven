import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../auth/guards/optional-jwt.guard';
import { Roles } from '../common/decorators/access.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ApiMessage } from '../common/responses/response.interceptor';
import {
  PaginationQueryDto,
  paginationMeta,
  skipTake,
} from '../common/pagination/pagination.dto';
import { number } from '../common/utils/money.util';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, RefundPaymentDto, VerifyPaymentDto } from './dto/payment.dto';

@ApiTags('Payments')
@Controller('payments')
@Public()
@UseGuards(OptionalAuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('create')
  @ApiMessage('Payment order created')
  create(
    @CurrentUser() user: AuthUser | null,
    @Headers('x-guest-token') guestToken: string | undefined,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.payments.create(user?.id, guestToken, dto);
  }

  @Post('verify')
  @ApiMessage('Payment verified')
  verify(
    @CurrentUser() user: AuthUser | null,
    @Headers('x-guest-token') guestToken: string | undefined,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.payments.verify(dto, user?.id, guestToken);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiMessage('Payment fetched successfully')
  async get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const payment = await this.payments.getById(id);
    if (!payment) throw new NotFoundException('Payment not found');
    const order = await this.payments.orderForPayment(id);
    const isStaff = user.roles.some((role) => role !== RoleName.CUSTOMER);
    if (!isStaff && order?.userId !== user.id) throw new NotFoundException('Payment not found');
    return { ...payment, amount: number(payment.amount) };
  }
}

@ApiTags('Admin payments')
@Controller('admin/payments')
@UseGuards(JwtAuthGuard)
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER, RoleName.ORDER_MANAGER)
  @ApiMessage('Payments fetched successfully')
  async list(@Query() query: PaginationQueryDto) {
    const { skip, take } = skipTake(query.page, query.limit);
    const [items, total] = await this.payments.list(skip, take);
    return { data: items, meta: paginationMeta(query.page, query.limit, total) };
  }

  @Post(':id/refund')
  @Roles(RoleName.SUPER_ADMIN, RoleName.STORE_MANAGER)
  @ApiMessage('Refund initiated')
  refund(
    @Param('id') id: string,
    @Body() dto: RefundPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.refund(id, dto, user.id);
  }
}
