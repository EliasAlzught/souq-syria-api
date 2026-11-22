/**
 * سكربت تعبئة قاعدة البيانات ببيانات وهمية واقعية للتجربة المحلية.
 * التشغيل: npm run db:seed
 *
 * ⚠️ لا تشغّله أبداً على قاعدة بيانات إنتاج حقيقية - هاد للتطوير والاختبار فقط.
 */
// ts-node ما بيقرأ ملف .env تلقائياً (بعكس أوامر Prisma CLI متل migrate/generate)
// فلازم نحمّله يدوياً هون قبل أي شي تاني.
import 'dotenv/config';
import {
  PrismaClient,
  ListingStatus,
  TransactionType,
  TransactionStatus,
  ReportStatus,
  PaymentPurpose,
  PaymentRequestStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 تنظيف البيانات القديمة...');
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.paymentRequest.deleteMany();
  await prisma.report.deleteMany();
  await prisma.listingImage.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.package.deleteMany();
  await prisma.paymentSettings.deleteMany();
  await prisma.deviceToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.user.deleteMany();
  await prisma.area.deleteMany();
  await prisma.category.deleteMany();

  // ---------- الأقسام ----------
  console.log('📂 إنشاء الأقسام...');
  const categoryNames = [
    'أثاث',
    'إلكترونيات',
    'ملابس',
    'سيارات',
    'أدوات منزلية',
    'أخرى',
  ];
  const categories = await Promise.all(
    categoryNames.map((name) =>
      prisma.category.create({
        data: { name, slug: slugify(name) },
      }),
    ),
  );
  const categoryByName = Object.fromEntries(categories.map((c) => [c.name, c]));

  // ---------- المناطق ----------
  console.log('📍 إنشاء المناطق...');
  const districts = [
    'المزة',
    'ركن الدين',
    'المالكي',
    'باب توما',
    'كفرسوسة',
    'القصاع',
  ];
  const areas = await Promise.all(
    districts.map((district) =>
      prisma.area.create({ data: { city: 'دمشق', district } }),
    ),
  );
  const areaByName = Object.fromEntries(areas.map((a) => [a.district, a]));

  // ---------- باقات الإعلانات ----------
  console.log('📦 إنشاء باقات الإعلانات...');
  const [package5, package20, package50] = await Promise.all([
    prisma.package.create({
      data: { name: 'باقة 5 إعلانات', listingsCount: 5, priceSyp: 45 },
    }),
    prisma.package.create({
      data: { name: 'باقة 20 إعلان', listingsCount: 20, priceSyp: 160 },
    }),
    prisma.package.create({
      data: { name: 'باقة 50 إعلان', listingsCount: 50, priceSyp: 350 },
    }),
  ]);

  // ---------- إعدادات استلام الدفع عبر شام كاش ----------
  console.log('💳 إنشاء إعدادات شام كاش...');
  await prisma.paymentSettings.create({
    data: {
      id: 'singleton',
      shamCashPhone: '0999123456',
      shamCashHolderName: 'سوقنا - إدارة التطبيق',
      qrImageUrl: 'https://picsum.photos/seed/shamcash-qr/400/400', // مؤقت - الأدمن بيرفع QR الحقيقي من لوحة التحكم
    },
  });

  // ---------- المستخدمون ----------
  console.log('👥 إنشاء المستخدمين...');
  const [admin, khaled, abuMohammad, sara, rami, lina] = await Promise.all([
    prisma.user.create({
      data: {
        phone: '+963900000001',
        name: 'إدارة سوقنا',
        role: 'ADMIN',
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        phone: '+963912345678',
        name: 'خالد العلي',
        role: 'USER',
        isVerified: true,
        ratingAvg: 4.9,
        ratingCount: 21,
        walletBalance: 8500,
        freeListingsUsed: 1, // لسا عنده إعلانين مجانيين
      },
    }),
    prisma.user.create({
      data: {
        phone: '+963933111222',
        name: 'أبو محمد',
        role: 'USER',
        isVerified: true,
        ratingAvg: 4.8,
        ratingCount: 14,
        freeListingsUsed: 2, // لسا عنده إعلان مجاني وحد
      },
    }),
    prisma.user.create({
      data: {
        phone: '+963944222333',
        name: 'سارة حمدان',
        role: 'USER',
        isVerified: true,
        ratingAvg: 4.6,
        ratingCount: 6,
        freeListingsUsed: 3, // استهلكت كل المجاني
        packageListingsRemaining: 5, // بس عندها باقة فعّالة (باقة 5)
      },
    }),
    prisma.user.create({
      data: {
        phone: '+963955333444',
        name: 'رامي يوسف',
        role: 'USER',
        isVerified: false,
        // ما استخدم ولا إعلان مجاني بعد (freeListingsUsed = 0 افتراضياً)
      },
    }),
    prisma.user.create({
      data: {
        phone: '+963966444555',
        name: 'لينا قاسم',
        role: 'USER',
        isVerified: true,
        ratingAvg: 5.0,
        ratingCount: 3,
        freeListingsUsed: 3, // استهلكت المجاني وما عندها باقة - أي إعلان جديد رح يحتاج دفع
      },
    }),
  ]);

  // ---------- الإعلانات ----------
  console.log('🛋️ إنشاء الإعلانات...');
  const listingsData = [
    {
      seller: abuMohammad,
      title: 'طاولة طعام خشب طبيعي',
      description:
        'طاولة طعام خشب طبيعي صلب، 6 كراسي، استخدام بسيط، بحالة ممتازة. سبب البيع السفر.',
      priceSyp: 45000,
      category: 'أثاث',
      area: 'المزة',
      status: ListingStatus.ACTIVE,
      boosted: true,
      isVerifiedTag: true,
    },
    {
      seller: sara,
      title: 'تلفاز سامسونج 43 بوصة',
      description: 'تلفاز سامسونج سمارت 43 بوصة، شغال تمام، فيه ريموت أصلي.',
      priceSyp: 120000,
      category: 'إلكترونيات',
      area: 'ركن الدين',
      status: ListingStatus.ACTIVE,
    },
    {
      seller: rami,
      title: 'دراجة أطفال مقاس صغير',
      description: 'دراجة أطفال عمر 3-6 سنوات، عجلات مطاط، فرامل سليمة.',
      priceSyp: 15000,
      category: 'أخرى',
      area: 'المالكي',
      status: ListingStatus.ACTIVE,
    },
    {
      seller: lina,
      title: 'مكتبة كتب خشبية 5 أرفف',
      description: 'مكتبة خشب MDF، 5 أرفف، مناسبة لغرفة الدراسة أو الصالون.',
      priceSyp: 22000,
      category: 'أثاث',
      area: 'باب توما',
      status: ListingStatus.ACTIVE,
    },
    {
      seller: khaled,
      title: 'غسالة أوتوماتيك LG',
      description: 'غسالة أوتوماتيك 7 كيلو، بحالة جيدة جداً، صيانة دورية.',
      priceSyp: 180000,
      category: 'أدوات منزلية',
      area: 'كفرسوسة',
      status: ListingStatus.ACTIVE,
    },
    {
      seller: sara,
      title: 'جاكيت شتوي رجالي مقاس L',
      description: 'جاكيت شتوي ثقيل، لبس موسم واحد بس، نظيف جداً.',
      priceSyp: 18000,
      category: 'ملابس',
      area: 'القصاع',
      status: ListingStatus.ACTIVE,
    },
    {
      seller: abuMohammad,
      title: 'سيارة كيا سيراتو موديل 2015',
      description: 'كيا سيراتو فل أوبشن، فحص كامل، صيانة منتظمة، بدون حوادث.',
      priceSyp: 45000000,
      category: 'سيارات',
      area: 'المزة',
      status: ListingStatus.ACTIVE,
      isVerifiedTag: true,
    },
    {
      seller: rami,
      title: 'طقم كنب 7 مقاعد',
      description: 'طقم كنب قماش، لون بيج، بحالة جيدة، شوية استخدام بالمسندين.',
      priceSyp: 95000,
      category: 'أثاث',
      area: 'ركن الدين',
      status: ListingStatus.PENDING, // بانتظار موافقة الأدمن - لتجربة شاشة "الإعلانات المعلّقة"
    },
    {
      seller: lina,
      title: 'لابتوب ديل انسبايرون',
      description:
        'لابتوب ديل، رام 8 جيجا، هارد SSD، مناسب للدراسة والعمل المكتبي.',
      priceSyp: 350000,
      category: 'إلكترونيات',
      area: 'باب توما',
      status: ListingStatus.PENDING,
    },
    {
      seller: khaled,
      title: 'فستان سهرة مقاس M',
      description: 'فستان سهرة لبسة وحدة فقط، تنظيف جاف، لون كحلي.',
      priceSyp: 30000,
      category: 'ملابس',
      area: 'كفرسوسة',
      status: ListingStatus.SOLD,
    },
  ];

  const createdListings = [];
  for (const item of listingsData) {
    const listing = await prisma.listing.create({
      data: {
        sellerId: item.seller.id,
        categoryId: categoryByName[item.category].id,
        areaId: areaByName[item.area].id,
        title: item.title,
        description: item.description,
        priceSyp: item.priceSyp,
        status: item.status,
        isVerifiedTag: item.isVerifiedTag ?? false,
        boostedUntil: item.boosted
          ? new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
          : null,
        images: {
          create: [0, 1].map((i) => ({
            url: `https://picsum.photos/seed/${slugify(item.title)}-${i}/600/400`,
            position: i,
          })),
        },
      },
    });
    createdListings.push(listing);
  }

  // ---------- إعلان بانتظار الدفع (لتجربة طابور مراجعة الأدمن للمدفوعات) ----------
  console.log('💳 إنشاء إعلان بانتظار الدفع...');
  const pendingPaymentListing = await prisma.listing.create({
    data: {
      sellerId: lina.id, // لينا استهلكت كل إعلاناتها المجانية (راجع إعدادها فوق)
      categoryId: categoryByName['إلكترونيات'].id,
      areaId: areaByName['باب توما'].id,
      title: 'ميكروويف باناسونيك',
      description: 'ميكروويف باناسونيك سعة 25 لتر، شغال تمام، صيانة نظيفة.',
      priceSyp: 60000,
      status: ListingStatus.AWAITING_PAYMENT,
      images: {
        create: [
          {
            url: 'https://picsum.photos/seed/microwave-0/600/400',
            position: 0,
          },
        ],
      },
    },
  });
  await prisma.paymentRequest.create({
    data: {
      userId: lina.id,
      purpose: PaymentPurpose.LISTING,
      amountSyp: 10,
      listingId: pendingPaymentListing.id,
      status: PaymentRequestStatus.PENDING,
      senderNote: 'حوّلت من رقم 0966444555 الساعة 4 العصر تقريباً',
    },
  });

  // ---------- مثال على شراء باقة مؤكدة (سارة اشترت باقة 5 سابقاً) ----------
  await prisma.paymentRequest.create({
    data: {
      userId: sara.id,
      purpose: PaymentPurpose.PACKAGE,
      amountSyp: package5.priceSyp,
      packageId: package5.id,
      status: PaymentRequestStatus.CONFIRMED,
      reviewedByAdminId: admin.id,
      reviewedAt: new Date(),
    },
  });

  // ---------- محادثات ورسائل ----------
  console.log('💬 إنشاء محادثات تجريبية...');
  const tableListing = createdListings.find((l) => l.title.includes('طاولة'))!;
  const conversation = await prisma.conversation.create({
    data: {
      listingId: tableListing.id,
      buyerId: khaled.id,
      sellerId: abuMohammad.id,
    },
  });
  await prisma.message.createMany({
    data: [
      {
        conversationId: conversation.id,
        senderId: khaled.id,
        text: 'السلام عليكم، لسا الطاولة متوفرة؟',
        readAt: new Date(),
      },
      {
        conversationId: conversation.id,
        senderId: abuMohammad.id,
        text: 'وعليكم السلام، أيوا متوفرة',
        readAt: new Date(),
      },
      {
        conversationId: conversation.id,
        senderId: abuMohammad.id,
        text: 'السعر 45 ألف، قابل للتفاوض شوي',
        readAt: new Date(),
      },
      {
        conversationId: conversation.id,
        senderId: khaled.id,
        text: 'تمام، ممكن أشوفها بعد الظهر؟',
        readAt: null, // غير مقروءة بعد - لتجربة عداد "غير مقروء"
      },
    ],
  });

  // ---------- محفظة شام كاش ----------
  console.log('💰 إنشاء عمليات محفظة تجريبية...');
  await prisma.walletTransaction.createMany({
    data: [
      {
        userId: khaled.id,
        type: TransactionType.TOPUP,
        amountSyp: 10000,
        status: TransactionStatus.SUCCESS,
        shamCashRef: 'SC-DEMO-0001',
      },
      {
        userId: khaled.id,
        type: TransactionType.PROMOTION,
        amountSyp: 7500,
        status: TransactionStatus.SUCCESS,
        metadata: { listingId: tableListing.id, days: 5 },
      },
    ],
  });

  // ---------- إشعارات تجريبية ----------
  console.log('🔔 إنشاء إشعارات تجريبية...');
  await prisma.notification.createMany({
    data: [
      {
        userId: abuMohammad.id,
        title: 'رسالة جديدة من خالد العلي',
        body: '"تمام، ممكن أشوفها بعد الظهر؟"',
        isRead: false,
      },
      {
        userId: khaled.id,
        title: 'تم اعتماد إعلانك',
        body: '"طاولة طعام خشب طبيعي" صار ظاهر للجميع',
        isRead: true,
      },
    ],
  });

  // ---------- بلاغ تجريبي ----------
  console.log('🚩 إنشاء بلاغ تجريبي...');
  await prisma.report.create({
    data: {
      reporterId: sara.id,
      listingId: createdListings.find((l) => l.title.includes('كيا'))!.id,
      reason: 'السعر المكتوب غير منطقي مقارنة بحالة السيارة الموصوفة',
      status: ReportStatus.OPEN,
    },
  });

  console.log('✅ تمت تعبئة البيانات الوهمية بنجاح!');
  console.log(`   - ${categories.length} أقسام`);
  console.log(`   - ${areas.length} مناطق`);
  console.log(`   - 6 مستخدمين (admin: ${admin.phone})`);
  console.log(`   - ${createdListings.length} إعلانات`);
  console.log('   - محادثة واحدة فيها 4 رسائل');
  console.log('   - عمليتين محفظة، إشعارين، وبلاغ واحد');
  console.log(
    `   - 3 باقات: ${package5.name} (${package5.priceSyp} ل.س)، ${package20.name} (${package20.priceSyp} ل.س)، ${package50.name} (${package50.priceSyp} ل.س)`,
  );
  console.log(
    `   - إعلان "${pendingPaymentListing.title}" (لينا) بانتظار تأكيد دفع من الأدمن`,
  );
  console.log('   - طلب شراء باقة مؤكد مسبقاً (سارة)');
}

function slugify(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0600-\u06FF-]/g, '');
}

main()
  .catch((e) => {
    console.error('❌ فشلت تعبئة البيانات:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
