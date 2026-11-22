import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

@Module({
  imports: [JwtModule.register({}), NotificationsModule],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService],
})
export class ChatModule {}
