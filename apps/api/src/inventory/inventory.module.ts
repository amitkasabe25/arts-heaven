import { Module } from '@nestjs/common';
import { AuditService } from '../common/audit/audit.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, AuditService],
  exports: [InventoryService],
})
export class InventoryModule {}
