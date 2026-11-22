import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WalletService } from './wallet.service';
import { TopUpDto } from './dto/topup.dto';
import { ConfirmTopUpDto } from './dto/confirm-topup.dto';
import { PromoteListingDto } from './dto/promote-listing.dto';

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  getBalance(@CurrentUser('sub') userId: string) {
    return this.walletService.getBalance(userId);
  }

  @Get('transactions')
  getTransactions(@CurrentUser('sub') userId: string) {
    return this.walletService.getTransactions(userId);
  }

  @Post('topup')
  requestTopUp(@CurrentUser('sub') userId: string, @Body() dto: TopUpDto) {
    return this.walletService.requestTopUp(userId, dto.amountSyp);
  }

  @Post('topup/:transactionId/confirm')
  confirmTopUp(
    @CurrentUser('sub') userId: string,
    @Param('transactionId') transactionId: string,
    @Body() dto: ConfirmTopUpDto,
  ) {
    return this.walletService.confirmTopUp(
      userId,
      transactionId,
      dto.shamCashRef,
    );
  }

  @Post('promote')
  promoteListing(
    @CurrentUser('sub') userId: string,
    @Body() dto: PromoteListingDto,
  ) {
    return this.walletService.promoteListing(userId, dto);
  }
}
