import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Authenticates a request using the `jwt` Passport strategy.
 * Attaches the decoded user to `request.user` on success.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
