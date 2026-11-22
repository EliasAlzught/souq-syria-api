import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [ListingsModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
