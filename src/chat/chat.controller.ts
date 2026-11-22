import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { StartConversationDto } from './dto/start-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  getConversations(@CurrentUser('sub') userId: string) {
    return this.chatService.getConversations(userId);
  }

  @Get('conversations/:id/messages')
  getMessages(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.chatService.getMessages(id, userId);
  }

  @Post('conversations')
  startConversation(
    @CurrentUser('sub') userId: string,
    @Body() dto: StartConversationDto,
  ) {
    return this.chatService.startConversation(userId, dto.listingId);
  }

  // مسار REST احتياطي لإرسال رسالة (الطريقة الأساسية هي Socket.IO بالتطبيق الفعلي)
  @Post('messages')
  sendMessage(@CurrentUser('sub') userId: string, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(userId, dto);
  }
}
