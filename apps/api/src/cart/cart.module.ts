import { Module } from '@nestjs/common';
import { ProductCustomizationModule } from '../product-customization/product-customization.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [ProductCustomizationModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
