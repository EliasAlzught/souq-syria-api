import { Matches } from 'class-validator';

export class RequestOtpDto {
  // رقم هاتف سوري بصيغة دولية، مثال: +963912345678
  @Matches(/^\+963\d{9}$/, {
    message: 'رقم الهاتف يجب أن يكون بصيغة +963xxxxxxxxx',
  })
  phone: string;
}
