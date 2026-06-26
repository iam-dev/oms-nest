import { Strategy } from "passport-jwt";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { OrNeverType } from "../../utils/types/or-never.type";
import { JwtPayloadType } from "./types/jwt-payload.type";
import { AllConfigType } from "../../config/config.type";
import { UsersService } from "../../users/users.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    configService: ConfigService<AllConfigType>,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: (req: Request) => req?.cookies?.token ?? null,
      secretOrKey: configService.getOrThrow("auth.secret", { infer: true }),
    });
  }

  /**
   * Validate JWT payload: verify the user still exists and is enabled.
   * Rejects disabled or deleted accounts even if the token is still valid.
   */
  public async validate(
    payload: JwtPayloadType,
  ): Promise<OrNeverType<JwtPayloadType>> {
    if (!payload.id) {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findById(payload.id);
    if (!user || user.enabled === false) {
      throw new UnauthorizedException();
    }

    return payload;
  }
}
