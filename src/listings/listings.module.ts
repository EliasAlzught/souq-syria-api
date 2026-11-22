import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ListingsController } from './listings.controller';
import { CatalogController } from './catalog.controller';
import { ListingsService } from './listings.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ListingsController, CatalogController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
