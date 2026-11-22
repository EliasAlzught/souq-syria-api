import { IsString, MinLength } from 'class-validator';

export class SubmitPaymentNoteDto {
  // مثال: "حوّلت من رقم 0933xxxxx الساعة 3 العصر" - بيساعد الأدمن يطابق العملية بتطبيق شام كاش
  @IsString()
  @MinLength(3)
  senderNote: string;
}
