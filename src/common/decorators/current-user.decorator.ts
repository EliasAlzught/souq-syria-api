import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../../auth/strategies/jwt.strategy';

export const CurrentUser = createParamDecorator(
  (field: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: JwtPayload = request.user;
    return field ? user?.[field] : user;
  },
);
