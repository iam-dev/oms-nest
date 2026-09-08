import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Request,
  Response,
  Post,
  UseGuards,
  Patch,
  Delete,
  SerializeOptions,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ApiCookieAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthEmailLoginDto } from "./dto/auth-email-login.dto";
import { AuthForgotPasswordDto } from "./dto/auth-forgot-password.dto";
import { AuthConfirmEmailDto } from "./dto/auth-confirm-email.dto";
import { AuthResetPasswordDto } from "./dto/auth-reset-password.dto";
import { AuthUpdateDto } from "./dto/auth-update.dto";
import { AuthGuard } from "@nestjs/passport";
import { AuthRegisterLoginDto } from "./dto/auth-register-login.dto";
import { LoginResponseDto } from "./dto/login-response.dto";
import { NullableType } from "../utils/types/nullable.type";
import { User } from "../users/domain/user";
import { RefreshResponseDto } from "./dto/refresh-response.dto";
import { Response as ExpressResponse } from "express";
import { SkipRlsContext } from "../rls/rls.guard";

const isTest =
  process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development";

// BE-028: Drive cookie `secure` flag from an explicit COOKIE_SECURE env var
// rather than inferring from NODE_ENV.  This allows staging environments that
// run NODE_ENV=staging (not "development") to still serve non-HTTPS cookies
// when needed, and lets production configs be explicit.
//
// COOKIE_SECURE defaults to "true" in all non-development environments.
// Set COOKIE_SECURE=false in .env for local HTTP-only development.
const cookieSecure: boolean =
  process.env.COOKIE_SECURE !== undefined
    ? process.env.COOKIE_SECURE === "true"
    : process.env.NODE_ENV !== "development";

// BE-029: the frontend and API are served from two different hosts
// (next-staging.ordermysaddle.com vs api-nest-staging.ordermysaddle.com).  A
// cookie set without an explicit `Domain` is HOST-ONLY, so the session cookie
// was stored against the API host and never sent to the frontend host.  The
// Next.js middleware runs on the frontend host and reads this cookie, so it
// saw no token on every request and bounced every protected route to /login —
// which renders as a blank page once the client already believes it is logged
// in.  COOKIE_DOMAIN must be the shared parent (e.g. ".ordermysaddle.com").
//
// Leave COOKIE_DOMAIN unset for localhost, where both run on the same host and
// a host-only cookie is correct (and where a leading-dot domain is invalid).
const cookieDomain: string | undefined = process.env.COOKIE_DOMAIN || undefined;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: "lax" as const,
  path: "/",
  domain: cookieDomain,
  maxAge: 10 * 60 * 60 * 1000, // 10 hours
};

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: "lax" as const,
  path: "/api/v1/auth/refresh",
  domain: cookieDomain,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

@ApiTags("Auth")
@SkipRlsContext()
@Controller({
  path: "auth",
  version: "1",
})
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Throttle({
    short: { limit: isTest ? 1000 : 5, ttl: 1000 },
    medium: { limit: isTest ? 1000 : 20, ttl: 60000 },
    long: { limit: isTest ? 1000 : 60, ttl: 3600000 },
  })
  @SerializeOptions({
    groups: ["me"],
  })
  @Post("email/login")
  @ApiOkResponse({
    type: LoginResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  public async login(
    @Body() loginDto: AuthEmailLoginDto,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<LoginResponseDto> {
    const result = await this.service.validateLogin(loginDto);
    res.cookie("token", result.token, COOKIE_OPTIONS);
    if (result.refreshToken) {
      res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS);
    }
    return result;
  }

  @Throttle({
    short: { limit: isTest ? 1000 : 3, ttl: 1000 },
    medium: { limit: isTest ? 1000 : 10, ttl: 60000 },
    long: { limit: isTest ? 1000 : 30, ttl: 3600000 },
  })
  @Post("email/register")
  @HttpCode(HttpStatus.NO_CONTENT)
  async register(@Body() createUserDto: AuthRegisterLoginDto): Promise<void> {
    return this.service.register(createUserDto);
  }

  @Post("email/confirm")
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmEmail(
    @Body() confirmEmailDto: AuthConfirmEmailDto,
  ): Promise<void> {
    return this.service.confirmEmail(confirmEmailDto.hash);
  }

  @Post("email/confirm/new")
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmNewEmail(
    @Body() confirmEmailDto: AuthConfirmEmailDto,
  ): Promise<void> {
    return this.service.confirmNewEmail(confirmEmailDto.hash);
  }

  @Throttle({
    short: { limit: isTest ? 1000 : 3, ttl: 1000 },
    medium: { limit: isTest ? 1000 : 10, ttl: 60000 },
    long: { limit: isTest ? 1000 : 30, ttl: 3600000 },
  })
  @Post("forgot/password")
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(
    @Body() forgotPasswordDto: AuthForgotPasswordDto,
  ): Promise<void> {
    return this.service.forgotPassword(forgotPasswordDto.email);
  }

  @Throttle({
    short: { limit: isTest ? 1000 : 3, ttl: 1000 },
    medium: { limit: isTest ? 1000 : 10, ttl: 60000 },
    long: { limit: isTest ? 1000 : 30, ttl: 3600000 },
  })
  @Post("reset/password")
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(@Body() resetPasswordDto: AuthResetPasswordDto): Promise<void> {
    return this.service.resetPassword(
      resetPasswordDto.hash,
      resetPasswordDto.password,
    );
  }

  @ApiCookieAuth("token")
  @SerializeOptions({
    groups: ["me"],
  })
  @Get("me")
  @UseGuards(AuthGuard("jwt"))
  @ApiOkResponse({
    type: User,
  })
  @HttpCode(HttpStatus.OK)
  public me(@Request() request): Promise<NullableType<User>> {
    return this.service.me(request.user);
  }

  @ApiCookieAuth("token")
  @ApiOkResponse({
    type: RefreshResponseDto,
  })
  @SerializeOptions({
    groups: ["me"],
  })
  @Post("refresh")
  @UseGuards(AuthGuard("jwt-refresh"))
  @HttpCode(HttpStatus.OK)
  public async refresh(
    @Request() request,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<RefreshResponseDto> {
    const result = await this.service.refreshToken({
      sessionId: request.user.sessionId,
      hash: request.user.hash,
    });
    res.cookie("token", result.token, COOKIE_OPTIONS);
    if (result.refreshToken) {
      res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS);
    }
    return result;
  }

  @ApiCookieAuth("token")
  @Post("logout")
  @UseGuards(AuthGuard("jwt"))
  @HttpCode(HttpStatus.NO_CONTENT)
  public async logout(
    @Request() request,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<void> {
    await this.service.logout({
      sessionId: request.user.sessionId,
    });
    // Domain must match the one used when setting the cookie, otherwise the
    // browser keeps the original cookie and logout silently leaves the session
    // active.
    res.clearCookie("token", { path: "/", domain: cookieDomain });
    res.clearCookie("refreshToken", {
      path: "/api/v1/auth/refresh",
      domain: cookieDomain,
    });
  }

  @ApiCookieAuth("token")
  @SerializeOptions({
    groups: ["me"],
  })
  @Patch("me")
  @UseGuards(AuthGuard("jwt"))
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: User,
  })
  public update(
    @Request() request,
    @Body() userDto: AuthUpdateDto,
  ): Promise<NullableType<User>> {
    return this.service.update(request.user, userDto);
  }

  @ApiCookieAuth("token")
  @Delete("me")
  @UseGuards(AuthGuard("jwt"))
  @HttpCode(HttpStatus.NO_CONTENT)
  public async delete(@Request() request): Promise<void> {
    return this.service.softDelete(request.user);
  }
}
