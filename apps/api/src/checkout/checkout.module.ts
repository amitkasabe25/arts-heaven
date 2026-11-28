import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { CouponsModule } from '../coupons/coupons.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ShippingModule } from '../shipping/shipping.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommonServicesModule } from '../common/common-services.module';
import { ProductCustomizationModule } from '../product-customization/product-customization.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [
    CartModule,
    CouponsModule,
    InventoryModule,
    ShippingModule,
    NotificationsModule,
    CommonServicesModule,
    ProductCustomizationModule,
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
