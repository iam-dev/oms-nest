import {
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import ms from "ms";
import crypto from "crypto";
import { randomStringGenerator } from "@nestjs/common/utils/random-string-generator.util";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { AuthEmailLoginDto } from "./dto/auth-email-login.dto";
import { AuthUpdateDto } from "./dto/auth-update.dto";
import { AuthProvidersEnum } from "./auth-providers.enum";
import { SocialInterface } from "../social/interfaces/social.interface";
import { AuthRegisterLoginDto } from "./dto/auth-register-login.dto";
import { NullableType } from "../utils/types/nullable.type";
import { LoginResponseDto } from "./dto/login-response.dto";
import { ConfigService } from "@nestjs/config";
import { JwtRefreshPayloadType } from "./strategies/types/jwt-refresh-payload.type";
import { JwtPayloadType } from "./strategies/types/jwt-payload.type";
import { UsersService } from "../users/users.service";
import { AllConfigType } from "../config/config.type";
import { MailService } from "../mail/mail.service";
import { RoleEnum } from "../roles/roles.enum";
import { SessionService } from "../session/session.service";
import { StatusEnum } from "../statuses/statuses.enum";
import { User } from "../users/domain/user";
import { AuditLoggingService } from "../audit-logging/audit-logging.service";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private sessionService: SessionService,
    private mailService: MailService,
    private configService: ConfigService<AllConfigType>,
    private auditLoggingService: AuditLoggingService,
  ) {}

  async validateLogin(loginDto: AuthEmailLoginDto): Promise<LoginResponseDto> {
    // Try to find user by email or username
    const user = await this.usersService.findByEmailOrUsername(loginDto.email);

    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: "notFound",
        },
      });
    }

    if (user.provider !== AuthProvidersEnum.email) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: `needLoginViaProvider:${user.provider}`,
        },
      });
    }

    // TODO(security/BE-001): Implement brute-force lockout.
    // The User domain and credentials table currently have no `failed_login_attempts`
    // or `locked_until` columns. To implement properly:
    //   1. Add `failedLoginAttempts: number` and `lockedUntil: Date | null` to the
    //      User domain, UserEntity, and a DB migration.
    //   2. On wrong password → increment counter; when count >= 5 set lockedUntil = now+15min.
    //   3. On successful login → reset both fields to 0 / null.
    //   4. Check lockedUntil here before the password compare and throw 422 {account:"locked"}.
    // Until then the original dead-code lockout branch has been removed to avoid confusion.

    if (!user.password) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          password: "incorrectPassword",
        },
      });
    }

    const isValidPassword = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isValidPassword) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          password: "incorrectPassword",
        },
      });
    }

    // For now, skip session creation as staging DB doesn't have session table
    // const hash = crypto
    //   .createHash("sha256")
    //   .update(randomStringGenerator())
    //   .digest("hex");

    // const session = await this.sessionService.create({
    //   user,
    //   hash,
    // });

    // Resolve user role based on database fields (user_type and supervisor)
    const userRole = await this.usersService.getUserRole(
      user.legacyId!,
      user.username,
      user.userType,
      user.isSupervisor,
    );

    // Convert role object to roles array format expected by frontend
    // Frontend expects: roles: ["ROLE_ADMIN", "ROLE_FITTER", etc.]
    const roleNameToFrontend: Record<string, string> = {
      fitter: "ROLE_FITTER",
      admin: "ROLE_ADMIN",
      factory: "ROLE_SUPPLIER", // Note: backend "factory" maps to frontend "SUPPLIER"
      customsaddler: "ROLE_SUPPLIER",
      supervisor: "ROLE_SUPERVISOR",
      user: "ROLE_USER",
    };
    const frontendRole =
      roleNameToFrontend[userRole.name.toLowerCase()] || "ROLE_USER";

    // Simple token for testing (without session management)
    const token = await this.jwtService.signAsync(
      {
        id: user.id,
        legacyId: user.legacyId,
        role: userRole, // Keep original for backend use
        roles: [frontendRole], // Add array format for frontend
        username: user.username,
        enabled: user.enabled,
      },
      {
        secret: this.configService.getOrThrow("auth.secret", { infer: true }),
        expiresIn: this.configService.getOrThrow("auth.expires", {
          infer: true,
        }),
      },
    );

    // Fire-and-forget audit log for login — use legacyId (integer) for audit
    const userId = user.legacyId ?? 0;
    this.auditLoggingService
      .logAction(
        userId,
        "user_login",
        undefined,
        undefined,
        undefined,
        1,
        "User",
        String(user.id),
      )
      .catch((error) => {
        this.logger.error(
          `Failed to create audit log: ${error.message}`,
          error.stack,
        );
      });

    const tokenExpiresIn = this.configService.getOrThrow("auth.expires", {
      infer: true,
    });

    return {
      token,
      refreshToken: null, // Session management disabled for staging compatibility
      tokenExpires: Date.now() + ms(tokenExpiresIn),
      user,
    };
  }

  async validateSocialLogin(
    authProvider: string,
    socialData: SocialInterface,
  ): Promise<LoginResponseDto> {
    let user: NullableType<User> = null;
    const socialEmail = socialData.email?.toLowerCase();
    let userByEmail: NullableType<User> = null;

    if (socialEmail) {
      userByEmail = await this.usersService.findByEmail(socialEmail);
    }

    if (socialData.id) {
      user = await this.usersService.findBySocialIdAndProvider({
        socialId: socialData.id,
        provider: authProvider,
      });
    }

    if (user) {
      // Social email update disabled for staging schema compatibility
      // if (socialEmail && !userByEmail) {
      //   user.email = socialEmail;
      // }
      // await this.usersService.update(user.id, user);
    } else if (userByEmail) {
      user = userByEmail;
    } else if (socialData.id) {
      const role = {
        id: RoleEnum.user,
      };
      const status = {
        id: StatusEnum.active,
      };

      user = await this.usersService.create({
        email: socialEmail ?? null,
        firstName: socialData.firstName ?? null,
        lastName: socialData.lastName ?? null,
        socialId: socialData.id,
        provider: authProvider,
        role,
        status,
      });

      user = await this.usersService.findById(user.id);
    }

    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          user: "userNotFound",
        },
      });
    }

    const hash = crypto
      .createHash("sha256")
      .update(randomStringGenerator())
      .digest("hex");

    const session = await this.sessionService.create({
      user,
      hash,
    });

    const {
      token: jwtToken,
      refreshToken,
      tokenExpires,
    } = await this.getTokensData({
      id: user.id,
      role: { id: 1, name: "user" },
      sessionId: session.id as number,
      hash,
    });

    return {
      refreshToken,
      token: jwtToken,
      tokenExpires,
      user,
    };
  }

  async register(dto: AuthRegisterLoginDto): Promise<void> {
    const user = await this.usersService.create({
      ...dto,
      email: dto.email,
      role: {
        id: RoleEnum.user,
      },
      status: {
        id: StatusEnum.inactive,
      },
    });

    const hash = await this.jwtService.signAsync(
      {
        confirmEmailUserId: user.id,
      },
      {
        secret: this.configService.getOrThrow("auth.confirmEmailSecret", {
          infer: true,
        }),
        expiresIn: this.configService.getOrThrow("auth.confirmEmailExpires", {
          infer: true,
        }),
      },
    );

    await this.mailService.userSignUp({
      to: dto.email,
      data: {
        hash,
      },
    });
  }

  async confirmEmail(hash: string): Promise<void> {
    let userId: User["id"];

    try {
      const jwtData = await this.jwtService.verifyAsync<{
        confirmEmailUserId: User["id"];
      }>(hash, {
        secret: this.configService.getOrThrow("auth.confirmEmailSecret", {
          infer: true,
        }),
      });

      userId = jwtData.confirmEmailUserId;
    } catch {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `invalidHash`,
        },
      });
    }

    const user = await this.usersService.findById(userId);

    if (!user || user.enabled) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        error: `notFound`,
      });
    }

    // Status update disabled for staging schema compatibility
    // user.status = {
    //   id: StatusEnum.active,
    // };
    // await this.usersService.update(user.id, user);

    // For staging schema, just mark user as enabled
    await this.usersService.update(user.id, { enabled: true });
  }

  async confirmNewEmail(hash: string): Promise<void> {
    let userId: User["id"];
    let newEmail: User["email"];

    try {
      const jwtData = await this.jwtService.verifyAsync<{
        confirmEmailUserId: User["id"];
        newEmail: User["email"];
      }>(hash, {
        secret: this.configService.getOrThrow("auth.confirmEmailSecret", {
          infer: true,
        }),
      });

      userId = jwtData.confirmEmailUserId;
      newEmail = jwtData.newEmail;
    } catch {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `invalidHash`,
        },
      });
    }

    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        error: `notFound`,
      });
    }

    // Email confirmation disabled for staging schema compatibility
    // user.email = newEmail;
    // user.status = {
    //   id: StatusEnum.active,
    // };
    // await this.usersService.update(user.id, user);

    // For staging schema, just update the email and enable user
    await this.usersService.update(user.id, { email: newEmail, enabled: true });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: "emailNotExists",
        },
      });
    }

    const tokenExpiresIn = this.configService.getOrThrow("auth.forgotExpires", {
      infer: true,
    });

    const tokenExpires = Date.now() + ms(tokenExpiresIn);

    const hash = await this.jwtService.signAsync(
      {
        forgotUserId: user.id,
      },
      {
        secret: this.configService.getOrThrow("auth.forgotSecret", {
          infer: true,
        }),
        expiresIn: tokenExpiresIn,
      },
    );

    await this.mailService.forgotPassword({
      to: email,
      data: {
        hash,
        tokenExpires,
      },
    });
  }

  async resetPassword(hash: string, password: string): Promise<void> {
    let userId: User["id"];

    try {
      const jwtData = await this.jwtService.verifyAsync<{
        forgotUserId: User["id"];
      }>(hash, {
        secret: this.configService.getOrThrow("auth.forgotSecret", {
          infer: true,
        }),
      });

      userId = jwtData.forgotUserId;
    } catch {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `invalidHash`,
        },
      });
    }

    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `notFound`,
        },
      });
    }

    // Password reset functionality
    // Session deletion may fail if session table doesn't exist (staging DB)
    try {
      await this.sessionService.deleteByUserId({
        userId: user.id,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to delete sessions for user ${user.id}: ${error.message}`,
      );
    }

    await this.usersService.update(user.id, { password });
  }

  async me(userJwtPayload: JwtPayloadType): Promise<NullableType<User>> {
    const user = await this.usersService.findById(userJwtPayload.id);
    if (!user) return null;

    // Get dynamically computed role based on database fields (user_type and supervisor)
    const role = await this.usersService.getUserRole(
      user.legacyId!,
      user.username,
      user.userType,
      user.isSupervisor,
    );

    // Return user with typeName for frontend role mapping
    return {
      ...user,
      typeName: role.name,
    };
  }

  async update(
    userJwtPayload: JwtPayloadType,
    userDto: AuthUpdateDto,
  ): Promise<NullableType<User>> {
    const currentUser = await this.usersService.findById(userJwtPayload.id);

    if (!currentUser) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          user: "userNotFound",
        },
      });
    }

    if (userDto.password) {
      if (!userDto.oldPassword) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            oldPassword: "missingOldPassword",
          },
        });
      }

      if (!currentUser.password) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            oldPassword: "incorrectOldPassword",
          },
        });
      }

      const isValidOldPassword = await bcrypt.compare(
        userDto.oldPassword,
        currentUser.password,
      );

      if (!isValidOldPassword) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            oldPassword: "incorrectOldPassword",
          },
        });
      } else {
        // Session management disabled for staging compatibility
        // await this.sessionService.deleteByUserIdWithExclude({
        //   userId: currentUser.id,
        //   excludeSessionId: userJwtPayload.sessionId,
        // });
      }
    }

    if (userDto.email && userDto.email !== currentUser.email) {
      const userByEmail = await this.usersService.findByEmail(userDto.email);

      if (userByEmail && userByEmail.id !== currentUser.id) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: "emailExists",
          },
        });
      }

      const hash = await this.jwtService.signAsync(
        {
          confirmEmailUserId: currentUser.id,
          newEmail: userDto.email,
        },
        {
          secret: this.configService.getOrThrow("auth.confirmEmailSecret", {
            infer: true,
          }),
          expiresIn: this.configService.getOrThrow("auth.confirmEmailExpires", {
            infer: true,
          }),
        },
      );

      await this.mailService.confirmNewEmail({
        to: userDto.email,
        data: {
          hash,
        },
      });
    }

    delete userDto.email;
    delete userDto.oldPassword;

    await this.usersService.update(userJwtPayload.id, userDto);

    return this.usersService.findById(userJwtPayload.id);
  }

  async refreshToken(
    data: Pick<JwtRefreshPayloadType, "sessionId" | "hash">,
  ): Promise<Omit<LoginResponseDto, "user">> {
    const session = await this.sessionService.findById(data.sessionId);

    if (!session) {
      throw new UnauthorizedException();
    }

    if (session.hash !== data.hash) {
      throw new UnauthorizedException();
    }

    const hash = crypto
      .createHash("sha256")
      .update(randomStringGenerator())
      .digest("hex");

    const user = await this.usersService.findById(session.user.id);

    if (!user) {
      throw new UnauthorizedException();
    }

    await this.sessionService.update(session.id, {
      hash,
    });

    const { token, refreshToken, tokenExpires } = await this.getTokensData({
      id: session.user.id,
      role: { id: 1, name: "user" },
      sessionId: session.id as number,
      hash,
    });

    return {
      token,
      refreshToken,
      tokenExpires,
    };
  }

  async softDelete(user: User): Promise<void> {
    await this.usersService.remove(user.id);
  }

  async logout(data: Pick<JwtRefreshPayloadType, "sessionId">) {
    // TODO(security/BE-002): Session management is disabled for staging compatibility
    // (session table may not exist). When re-enabling sessions, remove this guard
    // and ensure the session table is present in all environments.
    // Session creation is commented out in validateLogin(); refreshToken is effectively
    // non-functional until sessions are re-enabled.
    if (!data.sessionId) {
      // No session to delete — no-op instead of crashing.
      return;
    }
    return this.sessionService.deleteById(data.sessionId).catch((err) => {
      this.logger.warn(
        `Logout: failed to delete session ${data.sessionId}: ${err.message}`,
      );
    });
  }

  private async getTokensData(data: {
    id: User["id"];
    role: { id: number; name: string };
    sessionId: number;
    hash: string;
  }) {
    const tokenExpiresIn = this.configService.getOrThrow("auth.expires", {
      infer: true,
    });

    const tokenExpires = Date.now() + ms(tokenExpiresIn);

    const [token, refreshToken] = await Promise.all([
      await this.jwtService.signAsync(
        {
          id: data.id,
          role: data.role,
          sessionId: data.sessionId,
        },
        {
          secret: this.configService.getOrThrow("auth.secret", { infer: true }),
          expiresIn: tokenExpiresIn,
        },
      ),
      await this.jwtService.signAsync(
        {
          sessionId: data.sessionId,
          hash: data.hash,
        },
        {
          secret: this.configService.getOrThrow("auth.refreshSecret", {
            infer: true,
          }),
          expiresIn: this.configService.getOrThrow("auth.refreshExpires", {
            infer: true,
          }),
        },
      ),
    ]);

    return {
      token,
      refreshToken,
      tokenExpires,
    };
  }

  /**
   * Validate login security (production feature)
   */
  async validateLoginSecurity(
    loginDto: AuthEmailLoginDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<LoginResponseDto> {
    const user = await this.usersService.findByEmailOrUsername(loginDto.email);

    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { email: "notFound" },
      });
    }

    // Validate security constraints
    try {
      await this.usersService.validateLoginSecurity(user.id, ipAddress);
    } catch {
      throw new UnauthorizedException("Account locked due to security policy");
    }

    // Record login attempt
    await this.usersService.recordLoginAttempt({
      userId: user.id,
      ipAddress,
      userAgent,
      success: true,
      timestamp: new Date(),
    });

    return this.validateLogin(loginDto);
  }

  /**
   * Audit login attempt (production feature)
   */
  async auditLoginAttempt(
    userId: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
  ): Promise<void> {
    // Implementation for audit logging
    await this.logSecurityAttempt(userId, ipAddress, userAgent, success);
  }

  /**
   * Validate login with audit trail (production feature)
   */
  async validateLoginWithAudit(
    loginDto: AuthEmailLoginDto,
    auditContext: any,
  ): Promise<LoginResponseDto> {
    const user = await this.usersService.findByEmailOrUsername(loginDto.email);

    if (!user) {
      // Log failed attempt - user not found
      await this.usersService.recordLoginAttempt({
        userId: null,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        success: false,
        timestamp: new Date(),
        sessionId: auditContext.sessionId,
        failureReason: "User not found",
      });
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { email: "notFound" },
      });
    }

    try {
      // Attempt to validate login
      const result = await this.validateLogin(loginDto);

      // Log successful attempt
      await this.usersService.recordLoginAttempt({
        userId: user.id,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        success: true,
        timestamp: new Date(),
        sessionId: auditContext.sessionId,
      });

      return result;
    } catch (error) {
      // Log failed attempt
      let failureReason = "Login failed";
      if (error instanceof UnprocessableEntityException) {
        const errorData = error.getResponse() as any;
        if (errorData.errors?.password) {
          failureReason = "Invalid password";
        } else if (errorData.errors?.account) {
          failureReason = "Account locked";
        }
      }

      await this.usersService.recordLoginAttempt({
        userId: user.id,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        success: false,
        timestamp: new Date(),
        sessionId: auditContext.sessionId,
        failureReason,
      });

      throw error;
    }
  }

  /**
   * Log security attempt
   */
  private logSecurityAttempt(
    userId: string,
    ipAddress: string,
    _userAgent: string,
    success: boolean,
  ): void {
    // Basic security logging implementation
    this.logger.log(
      `Security attempt: User ${userId}, IP ${ipAddress}, Success: ${success}`,
    );
  }
}
