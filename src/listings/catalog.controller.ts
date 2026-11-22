import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class CatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('categories')
  findCategories() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  @Get('areas')
  findAreas() {
    return this.prisma.area.findMany({
      orderBy: [{ city: 'asc' }, { district: 'asc' }],
    });
  }
}
