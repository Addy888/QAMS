import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Role } from "./role.enum";

export interface CurrentUserPayload {
  id: string;
  username: string;
  role: Role;
}

/**
 * Pulls the JWT-resolved user from the request — populated by `JwtAuthGuard`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as CurrentUserPayload;
  },
);
