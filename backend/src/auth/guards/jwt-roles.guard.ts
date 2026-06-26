/**
 * BE-030: Composed guard that chains AuthGuard('jwt') + RolesGuard so callers
 * only need a single \@UseGuards(JwtRolesGuard) decorator.
 *
 * TODO(BE-030): Refactor remaining controllers that use
 *   \@UseGuards(AuthGuard('jwt'), RolesGuard)
 *   to use JwtRolesGuard instead.  custom-order-views is the first migrated site.
 */
import { Injectable, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "../../roles/roles.guard";

/**
 * Combined JWT authentication + role enforcement guard.
 *
 * Usage (on controller class or individual route handler):
 * ```typescript
 * \@Roles(RoleEnum.admin, RoleEnum.fitter)
 * \@UseGuards(JwtRolesGuard)
 * ```
 */
@Injectable()
export class JwtRolesGuard extends AuthGuard("jwt") {
  private readonly rolesGuard: RolesGuard;

  constructor(private readonly reflector: Reflector) {
    super();
    this.rolesGuard = new RolesGuard(reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First run JWT authentication — populates request.user
    const jwtPassed = await super.canActivate(context);
    if (!jwtPassed) return false;

    // Then enforce role-based access
    return this.rolesGuard.canActivate(context);
  }
}
