import { Injectable } from '@nestjs/common';
import { ListingStatus, ReportStatus, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [
      totalUsers,
      activeListings,
      pendingListings,
      openReports,
      totalTopUpsSyp,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.listing.count({ where: { status: ListingStatus.ACTIVE } }),
      this.prisma.listing.count({ where: { status: ListingStatus.PENDING } }),
      this.prisma.report.count({ where: { status: ReportStatus.OPEN } }),
      this.prisma.walletTransaction.aggregate({
        where: { type: 'TOPUP', status: TransactionStatus.SUCCESS },
        _sum: { amountSyp: true },
      }),
    ]);

    return {
      totalUsers,
      activeListings,
      pendingListings,
      openReports,
      totalTopUpsSyp: totalTopUpsSyp._sum.amountSyp ?? 0,
    };
  }
}
