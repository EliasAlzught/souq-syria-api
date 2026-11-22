import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListingsService } from '../listings/listings.service';
import { PromoteListingDto } from './dto/promote-listing.dto';

// سعر ثابت مبدئي لترقية الإعلان - قابل للتعديل لاحقاً أو ربطه بباقات مختلفة حسب الفئة
const PROMOTION_PRICE_PER_DAY_SYP = 1500;

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listingsService: ListingsService,
  ) {}

  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true },
    });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    return { balanceSyp: user.walletBalance };
  }

  async getTransactions(userId: string) {
    return this.prisma.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * يبدأ طلب شحن رصيد عبر شام كاش. يرجّع للمستخدم رقم العملية (transactionId)
   * ليستخدمه كمرجع عند الدفع الفعلي عبر تطبيق/بوابة شام كاش.
   */
  async requestTopUp(userId: string, amountSyp: number) {
    return this.prisma.walletTransaction.create({
      data: {
        userId,
        type: TransactionType.TOPUP,
        amountSyp,
        status: TransactionStatus.PENDING,
      },
    });
  }

  /**
   * ⚠️ مهم جداً بالإنتاج: هاد المسار حالياً "محاكاة" لتسهيل التطوير والاختبار فقط.
   * التأكيد الحقيقي للدفع يجب أن يصل عبر webhook موقّع (signed) من سيرفرات شام كاش
   * مباشرة، وليس استدعاءً من تطبيق المستخدم نفسه - وإلا أي مستخدم بيقدر "يأكد" شحن
   * بدون ما يكون دفع فعلياً. TODO: استبدال هاد الإندبوينت بـ webhook حقيقي قبل الإطلاق.
   */
  async confirmTopUp(
    userId: string,
    transactionId: string,
    shamCashRef: string,
  ) {
    const tx = await this.prisma.walletTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!tx || tx.userId !== userId) {
      throw new NotFoundException('عملية الشحن غير موجودة');
    }
    if (tx.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('هذه العملية تمت معالجتها مسبقاً');
    }

    const [updatedTx] = await this.prisma.$transaction([
      this.prisma.walletTransaction.update({
        where: { id: transactionId },
        data: { status: TransactionStatus.SUCCESS, shamCashRef },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { walletBalance: { increment: tx.amountSyp } },
      }),
    ]);

    return updatedTx;
  }

  /** ترقية إعلان مقابل خصم من رصيد المحفظة */
  async promoteListing(userId: string, dto: PromoteListingDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
    });
    if (!listing) throw new NotFoundException('الإعلان غير موجود');
    if (listing.sellerId !== userId) {
      throw new ForbiddenException('لا يمكنك ترقية إعلان لا تملكه');
    }

    const cost = PROMOTION_PRICE_PER_DAY_SYP * dto.days;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.walletBalance < cost) {
      throw new BadRequestException(
        'رصيد المحفظة غير كافٍ، الرجاء شحن الرصيد أولاً',
      );
    }

    const boostedUntil = new Date(Date.now() + dto.days * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { walletBalance: { decrement: cost } },
      }),
      this.prisma.walletTransaction.create({
        data: {
          userId,
          type: TransactionType.PROMOTION,
          amountSyp: cost,
          status: TransactionStatus.SUCCESS,
          metadata: { listingId: dto.listingId, days: dto.days },
        },
      }),
    ]);

    return this.listingsService.boost(dto.listingId, boostedUntil);
  }
}
