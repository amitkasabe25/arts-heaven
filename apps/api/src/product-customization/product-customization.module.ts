import { Module } from '@nestjs/common';
import { ProductCustomizationController } from './product-customization.controller';
import { CustomizationService } from './product-customization.service';

@Module({
  controllers: [ProductCustomizationController],
  providers: [CustomizationService],
  exports: [CustomizationService],
})
export class ProductCustomizationModule {}
