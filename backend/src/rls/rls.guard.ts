import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RlsService } from "./rls.service";
import { RoleEnum } from "../roles/roles.enum";

/**
 * Row Level Security Guard
 *
 * This guard automatically sets RLS context for incoming requests after JWT authentication.
 * It should be used alongside JWT guards to ensure proper data isolation.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, RlsGuard)
 * @Controller('customers')
 * export class CustomerController {
 *   // All methods will automatically have RLS context set
 * }
 *
 * The guard extracts user information from the JWT payload and sets the appropriate
 * RLS context, ensuring that all database queries are filtered based on user role and ownership.
 */
@Injectable()
export class RlsGuard implements CanActivate {
  private readonly logger = new Logger(RlsGuard.name);

  constructor(
    private readonly rlsService: RlsService,
    protected readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Set by JWT guard

    if (!user || !user.id) {
      // If no user context, allow through but don't set RLS context
      // This handles public endpoints or cases where JWT guard is not used
      return true;
    }

    try {
      // Extract user information from JWT payload
      const userId = user.id;
      const legacyId = user.legacyId;
      const userRole = user.role?.id || RoleEnum.user; // Default to user role

      // Get role-specific IDs
      let factoryId: string | undefined;
      let fitterId: string | undefined;

      if (userRole === RoleEnum.factory) {
        factoryId = user.factoryId;
      }

      if (userRole === RoleEnum.fitter) {
        fitterId = user.fitterId;
      }

      // Use legacyId (integer) for RLS context so current_user_id()::INTEGER works
      await this.rlsService.setUserContext(
        legacyId ? String(legacyId) : userId,
        userRole,
        factoryId,
        fitterId,
      );

      return true;
    } catch (error) {
      this.logger.error("Failed to set RLS context — denying request", error);
      return false;
    }
  }
}

/**
 * Decorator to skip RLS context setting for specific endpoints or controllers.
 * Can be applied at the class level (entire controller) or method level.
 */
export const SkipRlsContext = () => SetMetadata("skipRlsContext", true);

/**
 * Enhanced RLS Guard that respects SkipRlsContext decorator
 * on both handler (method) and class (controller) levels.
 */
@Injectable()
export class EnhancedRlsGuard extends RlsGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skipRls = this.reflector.getAllAndOverride<boolean>(
      "skipRlsContext",
      [context.getHandler(), context.getClass()],
    );

    if (skipRls) {
      return true;
    }

    return super.canActivate(context);
  }
}
