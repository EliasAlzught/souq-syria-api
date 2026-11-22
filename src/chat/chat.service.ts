import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async startConversation(buyerId: string, listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });
    if (!listing) throw new NotFoundException('الإعلان غير موجود');
    if (listing.sellerId === buyerId) {
      throw new BadRequestException('لا يمكنك بدء محادثة مع نفسك على إعلانك');
    }

    const existing = await this.prisma.conversation.findFirst({
      where: { listingId, buyerId, sellerId: listing.sellerId },
    });
    if (existing) return existing;

    return this.prisma.conversation.create({
      data: { listingId, buyerId, sellerId: listing.sellerId },
    });
  }

  async getConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      orderBy: { updatedAt: 'desc' },
      include: {
        listing: { select: { id: true, title: true, priceSyp: true } },
        buyer: { select: { id: true, name: true, phone: true } },
        seller: { select: { id: true, name: true, phone: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    // عدد الرسائل غير المقروءة بكل محادثة (للمستخدم الحالي)
    return Promise.all(
      conversations.map(async (c) => {
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: c.id,
            senderId: { not: userId },
            readAt: null,
          },
        });
        return { ...c, unreadCount };
      }),
    );
  }

  async getMessages(conversationId: string, userId: string) {
    await this.assertParticipant(conversationId, userId);

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    // علّم رسائل الطرف الآخر كمقروءة بمجرد ما المستخدم فتح المحادثة
    await this.markRead(conversationId, userId);

    return messages;
  }

  async sendMessage(senderId: string, dto: SendMessageDto) {
    const conversation = await this.assertParticipant(
      dto.conversationId,
      senderId,
    );

    const message = await this.prisma.message.create({
      data: {
        conversationId: dto.conversationId,
        senderId,
        text: dto.text,
        imageUrl: dto.imageUrl,
      },
    });

    await this.prisma.conversation.update({
      where: { id: dto.conversationId },
      data: { updatedAt: new Date() },
    });

    const recipientId =
      conversation.buyerId === senderId
        ? conversation.sellerId
        : conversation.buyerId;
    await this.notifications.notify(
      recipientId,
      'رسالة جديدة',
      dto.text ?? 'أرسل لك صورة',
    );

    return message;
  }

  async markRead(conversationId: string, userId: string) {
    await this.assertParticipant(conversationId, userId);
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });
    return { message: 'تم تحديث حالة القراءة' };
  }

  async assertParticipant(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('المحادثة غير موجودة');
    if (conversation.buyerId !== userId && conversation.sellerId !== userId) {
      throw new ForbiddenException('لا تملك صلاحية الوصول لهذه المحادثة');
    }
    return conversation;
  }
}
