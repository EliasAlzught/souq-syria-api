import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ListingStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { imageFileFilter, listingImageStorage } from './multer.config';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  findAll(@Query() query: QueryListingsDto) {
    return this.listingsService.findAll(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  findMine(
    @CurrentUser('sub') sellerId: string,
    @Query('status') status?: ListingStatus,
  ) {
    return this.listingsService.findMine(sellerId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.listingsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser('sub') sellerId: string, @Body() dto: CreateListingDto) {
    return this.listingsService.create(sellerId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('sub') sellerId: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listingsService.update(id, sellerId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('sub') sellerId: string) {
    return this.listingsService.remove(id, sellerId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/mark-sold')
  markSold(@Param('id') id: string, @CurrentUser('sub') sellerId: string) {
    return this.listingsService.markSold(id, sellerId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/images')
  @UseInterceptors(
    FilesInterceptor('files', 6, {
      storage: listingImageStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB لكل صورة
    }),
  )
  uploadImages(
    @Param('id') id: string,
    @CurrentUser('sub') sellerId: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    const urls = files.map((f) => `/uploads/listings/${f.filename}`);
    return this.listingsService.addImages(id, sellerId, urls);
  }

  // ---------- مسارات الأدمن (الموافقة على الإعلانات) ----------

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/pending')
  findPending() {
    return this.listingsService.findPendingForAdmin();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/:id/approve')
  approve(@Param('id') id: string) {
    return this.listingsService.approve(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/:id/reject')
  reject(@Param('id') id: string) {
    return this.listingsService.reject(id);
  }
}
