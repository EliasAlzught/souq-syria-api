import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [ListingsModule],
  controllers: [WalletController],
  providers: [WalletService],
})
export class WalletModule {}
