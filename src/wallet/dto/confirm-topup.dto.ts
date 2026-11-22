import { IsString } from 'class-validator';

export class ConfirmTopUpDto {
  // رقم العملية المرجعي من شام كاش - بالإنتاج هاد بيجي تلقائياً من webhook الموفر، مش من المستخدم مباشرة
  @IsString()
  shamCashRef: string;
}
