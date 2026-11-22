import { Injectable } from '@nestjs/common';
import { ReportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(reporterId: string, dto: CreateReportDto) {
    return this.prisma.report.create({
      data: { reporterId, listingId: dto.listingId, reason: dto.reason },
    });
  }

  // ---------- للأدمن ----------

  async findAll(status?: ReportStatus) {
    return this.prisma.report.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { id: true, name: true, phone: true } },
        listing: { select: { id: true, title: true } },
      },
    });
  }

  async updateStatus(id: string, status: ReportStatus) {
    return this.prisma.report.update({ where: { id }, data: { status } });
  }
}
