import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<(number | string)[]>(
      "roles",
      [context.getClass(), context.getHandler()],
    );
    if (!roles || !roles.length) {
      return true;
    }
    const request = context.switchToHttp().getRequest<{
      user?: { role?: { id?: number | string } };
    }>();

    // BE-025: null role.id on an authenticated request indicates a malformed JWT
    // or a code path that bypassed proper JWT validation. Fail explicitly.
    if (request.user?.role?.id == null) {
      this.logger.warn(
        `RolesGuard: authenticated request missing role.id — ` +
          `path=${(request as { path?: string }).path ?? "unknown"}`,
      );
      throw new UnauthorizedException("Missing role in JWT payload");
    }

    return roles.map(String).includes(String(request.user.role.id));
  }
}
