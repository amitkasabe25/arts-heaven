import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentProvider } from '@prisma/client';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { ApiMessage } from '../common/responses/response.interceptor';
import { WebhooksService } from './webhooks.service';

@ApiTags('Payment webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Public()
  @Post('razorpay')
  @HttpCode(HttpStatus.OK)
  @ApiMessage('Webhook received')
  async razorpay(
    @Req() request: Request,
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    return this.handle(PaymentProvider.RAZORPAY, request, payload, headers);
  }

  @Public()
  @Post('cashfree')
  @HttpCode(HttpStatus.OK)
  @ApiMessage('Webhook received')
  async cashfree(
    @Req() request: Request,
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    return this.handle(PaymentProvider.CASHFREE, request, payload, headers);
  }

  private handle(
    provider: PaymentProvider,
    request: Request,
    payload: Record<string, unknown>,
    headers: Record<string, string | undefined>,
  ) {
    if (!request.rawBody) throw new BadRequestException('Raw request body is required');
    return this.webhooks.handle(provider, request.rawBody, payload, headers);
  }
}
