import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";

/**
 * Extracts and validates the authenticated user's legacyId from the JWT payload.
 *
 * Throws UnauthorizedException if the JWT payload is missing or legacyId is
 * null / undefined — ensuring controllers do not receive an invalid user identity.
 *
 * @example
 * async create(@CurrentUserId() userId: number, @Body() dto: CreateDto) { ... }
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest<{ user?: { legacyId?: number } }>();
    const legacyId = request.user?.legacyId;

    if (legacyId === undefined || legacyId === null) {
      throw new UnauthorizedException("User legacyId not found in JWT payload");
    }

    return legacyId;
  },
);
