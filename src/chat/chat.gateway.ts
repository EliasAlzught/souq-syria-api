import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

interface AuthedSocket extends Socket {
  data: { userId: string };
}

/**
 * بروتوكول العميل (Flutter/socket_io_client):
 * - الاتصال: io(url, { auth: { token: accessToken } })
 * - الانضمام لمحادثة: socket.emit('joinConversation', { conversationId })
 * - إرسال رسالة: socket.emit('sendMessage', { conversationId, text })
 * - الاستماع لرسائل جديدة: socket.on('newMessage', (message) => ...)
 * - تعليم كمقروء: socket.emit('markRead', { conversationId })
 */
@WebSocketGateway({ namespace: 'chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: AuthedSocket) {
    try {
      const token =
        client.handshake.auth?.token ??
        client.handshake.headers?.authorization?.replace('Bearer ', '');
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('jwt.accessSecret'),
      });
      client.data.userId = payload.sub;
    } catch {
      this.logger.warn(`Socket rejected: invalid token (${client.id})`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket) {
    this.logger.log(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinConversation')
  async onJoin(client: AuthedSocket, payload: { conversationId: string }) {
    await this.chatService.assertParticipant(
      payload.conversationId,
      client.data.userId,
    );
    client.join(this.roomName(payload.conversationId));
    return { ok: true };
  }

  @SubscribeMessage('sendMessage')
  async onSendMessage(client: AuthedSocket, payload: SendMessageDto) {
    const message = await this.chatService.sendMessage(
      client.data.userId,
      payload,
    );
    this.server
      .to(this.roomName(payload.conversationId))
      .emit('newMessage', message);
    return message;
  }

  @SubscribeMessage('markRead')
  async onMarkRead(client: AuthedSocket, payload: { conversationId: string }) {
    const result = await this.chatService.markRead(
      payload.conversationId,
      client.data.userId,
    );
    this.server.to(this.roomName(payload.conversationId)).emit('readUpdate', {
      conversationId: payload.conversationId,
      byUserId: client.data.userId,
    });
    return result;
  }

  private roomName(conversationId: string): string {
    return `conversation:${conversationId}`;
  }
}
