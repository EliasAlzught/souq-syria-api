import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ListingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';

const LISTING_INCLUDE = {
  images: { orderBy: { position: 'asc' as const } },
  category: true,
  area: true,
  seller: {
    select: {
      id: true,
      name: true,
      phone: true,
      ratingAvg: true,
      ratingCount: true,
      isVerified: true,
    },
  },
};

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * منطق تسعير الإعلانات:
   * 1) أول N إعلان مجاني (FREE_LISTINGS_COUNT، افتراضياً 3) - يُنشر مباشرة للمراجعة (PENDING).
   * 2) إذا نفذت المجانية وعند المستخدم رصيد باقة (packageListingsRemaining > 0) - يُخصم واحد وينشر PENDING.
   * 3) غير هيك - الإعلان يُنشأ بحالة AWAITING_PAYMENT + طلب دفع شام كاش مرتبط فيه،
   *    وما بيصير PENDING (أي ما بيدخل مراجعة المحتوى) إلا بعد ما الأدمن يأكد وصول المبلغ.
   */
  async create(sellerId: string, dto: CreateListingDto) {
    const freeLimit = this.config.get<number>('pricing.freeListingsCount', 3);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: sellerId },
      select: { freeListingsUsed: true, packageListingsRemaining: true },
    });

    if (user.freeListingsUsed < freeLimit) {
      await this.prisma.user.update({
        where: { id: sellerId },
        data: { freeListingsUsed: { increment: 1 } },
      });
      return this.prisma.listing.create({
        data: { ...dto, sellerId, status: ListingStatus.PENDING },
        include: LISTING_INCLUDE,
      });
    }

    if (user.packageListingsRemaining > 0) {
      await this.prisma.user.update({
        where: { id: sellerId },
        data: { packageListingsRemaining: { decrement: 1 } },
      });
      return this.prisma.listing.create({
        data: { ...dto, sellerId, status: ListingStatus.PENDING },
        include: LISTING_INCLUDE,
      });
    }

    // ما في إعلانات مجانية ولا رصيد باقة - لازم دفع شام كاش لهاد الإعلان تحديداً
    const amountSyp = this.config.get<number>('pricing.listingPriceSyp', 10);
    const listing = await this.prisma.listing.create({
      data: { ...dto, sellerId, status: ListingStatus.AWAITING_PAYMENT },
      include: LISTING_INCLUDE,
    });
    const paymentRequest = await this.prisma.paymentRequest.create({
      data: {
        userId: sellerId,
        purpose: 'LISTING',
        amountSyp,
        listingId: listing.id,
      },
    });
    const paymentSettings = await this.prisma.paymentSettings
      .findUnique({ where: { id: 'singleton' } })
      .catch(() => null);

    return { listing, paymentRequest, paymentSettings, requiresPayment: true };
  }

  /** تُستدعى من PaymentsService بعد ما الأدمن يأكد وصول دفعة إعلان واحد */
  async activateAfterPayment(listingId: string) {
    return this.prisma.listing.update({
      where: { id: listingId },
      data: { status: ListingStatus.PENDING },
    });
  }

  /** تُستدعى من PaymentsService لو الأدمن رفض طلب الدفع (مثلاً المبلغ ما وصل فعلياً) */
  async rejectAfterPaymentFailure(listingId: string) {
    return this.prisma.listing.update({
      where: { id: listingId },
      data: { status: ListingStatus.REJECTED },
    });
  }

  /**
   * البحث والفلترة والترتيب والصفحات - يغطي متطلبات "البحث والأقسام"
   * ملاحظة: بشكل افتراضي بيرجع فقط الإعلانات ACTIVE (المعتمدة والمتاحة للجميع)،
   * والإعلانات المُرقّاة (boostedUntil بالمستقبل) بتظهر أول شي بغض النظر عن الترتيب المطلوب.
   */
  async findAll(query: QueryListingsDto) {
    const {
      q,
      categoryId,
      areaId,
      minPrice,
      maxPrice,
      sort = 'newest',
      page = 1,
      pageSize = 20,
    } = query;

    const where: Prisma.ListingWhereInput = {
      status: ListingStatus.ACTIVE,
      ...(categoryId ? { categoryId } : {}),
      ...(areaId ? { areaId } : {}),
      ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      ...(minPrice !== undefined || maxPrice !== undefined
        ? {
            priceSyp: {
              ...(minPrice !== undefined ? { gte: minPrice } : {}),
              ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
            },
          }
        : {}),
    };

    const orderBy: Prisma.ListingOrderByWithRelationInput[] = [
      // الإعلانات المُرقّاة أولاً دايماً، وبعدها الترتيب المطلوب
      { boostedUntil: 'desc' },
      ...(sort === 'price_asc'
        ? [{ priceSyp: 'asc' as const }]
        : sort === 'price_desc'
          ? [{ priceSyp: 'desc' as const }]
          : [{ createdAt: 'desc' as const }]),
    ];

    const [items, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: LISTING_INCLUDE,
      }),
      this.prisma.listing.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: LISTING_INCLUDE,
    });
    if (!listing) throw new NotFoundException('الإعلان غير موجود');
    return listing;
  }

  async findMine(sellerId: string, status?: ListingStatus) {
    return this.prisma.listing.findMany({
      where: { sellerId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      include: LISTING_INCLUDE,
    });
  }

  async update(id: string, sellerId: string, dto: UpdateListingDto) {
    await this.assertOwner(id, sellerId);
    // أي تعديل جوهري (سعر/وصف/عنوان) بيرجّع الإعلان لمراجعة الأدمن من جديد
    return this.prisma.listing.update({
      where: { id },
      data: { ...dto, status: ListingStatus.PENDING },
      include: LISTING_INCLUDE,
    });
  }

  async remove(id: string, sellerId: string) {
    await this.assertOwner(id, sellerId);
    await this.prisma.listing.delete({ where: { id } });
    return { message: 'تم حذف الإعلان' };
  }

  async markSold(id: string, sellerId: string) {
    await this.assertOwner(id, sellerId);
    return this.prisma.listing.update({
      where: { id },
      data: { status: ListingStatus.SOLD },
    });
  }

  async addImages(id: string, sellerId: string, urls: string[]) {
    await this.assertOwner(id, sellerId);
    const existingCount = await this.prisma.listingImage.count({
      where: { listingId: id },
    });
    await this.prisma.listingImage.createMany({
      data: urls.map((url, i) => ({
        listingId: id,
        url,
        position: existingCount + i,
      })),
    });
    return this.findOne(id);
  }

  // ---------- عمليات الأدمن (موافقة/رفض) ----------

  async findPendingForAdmin() {
    return this.prisma.listing.findMany({
      where: { status: ListingStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: LISTING_INCLUDE,
    });
  }

  async approve(id: string) {
    const listing = await this.prisma.listing.update({
      where: { id },
      data: { status: ListingStatus.ACTIVE },
      include: { area: true },
    });
    await this.notifications.notify(
      listing.sellerId,
      'تم اعتماد إعلانك',
      `"${listing.title}" صار ظاهر للجميع الآن`,
    );
    // بث عام لكل المستخدمين: "تم نشر إعلان عن طاولة في مدينة الزبداني..."
    await this.notifications.broadcastNewListing(
      listing.title,
      listing.area.city,
      listing.area.district,
    );
    return listing;
  }

  async reject(id: string) {
    const listing = await this.prisma.listing.update({
      where: { id },
      data: { status: ListingStatus.REJECTED },
    });
    await this.notifications.notify(
      listing.sellerId,
      'تم رفض إعلانك',
      `"${listing.title}" ما استوفى شروط النشر، راجع التفاصيل وحاول تاني`,
    );
    return listing;
  }

  /** تُستخدم من WalletService بعد نجاح عملية ترقية الإعلان */
  async boost(id: string, until: Date) {
    return this.prisma.listing.update({
      where: { id },
      data: { boostedUntil: until },
    });
  }

  private async assertOwner(id: string, sellerId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('الإعلان غير موجود');
    if (listing.sellerId !== sellerId) {
      throw new ForbiddenException('لا تملك صلاحية التعديل على هذا الإعلان');
    }
    return listing;
  }
}
