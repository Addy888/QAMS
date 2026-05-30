import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Role } from "./role.enum";

export interface JwtPayload {
  sub: string;
  username: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>("JWT_ACCESS_SECRET");
    if (!secret) {
      console.error(
        "[FATAL-CONFIG] JWT_ACCESS_SECRET is not set! Auth will NOT work. Set it in Vercel env vars.",
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret || "INSECURE_FALLBACK_DO_NOT_USE_IN_PRODUCTION",
    });
  }

  /**
   * Whatever this returns is attached to `request.user` and consumed by
   * `RolesGuard` and route handlers via `@CurrentUser()`.
   */
  validate(payload: JwtPayload) {
    return {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
    };
  }
}
