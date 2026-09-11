import "reflect-metadata";
import "dotenv/config";
import {
  ClassSerializerInterceptor,
  LogLevel,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory, Reflector } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { useContainer } from "class-validator";
import { AppModule } from "./app.module";
import validationOptions from "./utils/validation-options";
import { AllConfigType } from "./config/config.type";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { ResolvePromisesInterceptor } from "./utils/serializer.interceptor";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { configureTrustProxy } from "./common/configure-trust-proxy";

async function bootstrap() {
  const debugLog = process.env.DEBUG_LOG === "true";
  const logLevels: LogLevel[] = debugLog
    ? ["error", "warn", "log", "debug", "verbose"]
    : ["error", "warn", "log"];

  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
    : ["http://localhost:3000", "http://localhost:3001"];

  const app = await NestFactory.create(AppModule, {
    logger: logLevels,
    cors: {
      origin: corsOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "x-custom-lang",
        "Cache-Control",
        "Pragma",
        "Expires",
      ],
    },
  });
  // Must run before any IP-sensitive middleware/guard (ThrottlerGuard) so that
  // req.ip is the real client rather than the ingress controller pod.
  configureTrustProxy(app);
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  const configService = app.get(ConfigService<AllConfigType>);

  // BE-033: Configure CSP explicitly rather than relying on helmet's defaults.
  // reportOnly: true means violations are reported (to console / a future
  // report-uri endpoint) but NOT enforced yet.  Flip to reportOnly: false once
  // CSP violation reports have been reviewed and the directive set is confirmed
  // safe for all frontend assets and API responses.
  //
  // TODO(BE-033): After reviewing CSP violation reports in staging, remove
  // reportOnly: true to switch to enforce mode.
  app.use(
    helmet({
      contentSecurityPolicy: {
        reportOnly: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline may be needed by Swagger UI
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
    }),
  );
  app.use(cookieParser());
  app.enableShutdownHooks();
  app.setGlobalPrefix(
    configService.getOrThrow("app.apiPrefix", { infer: true }),
    {
      exclude: ["/"],
    },
  );
  app.enableVersioning({
    type: VersioningType.URI,
  });
  app.useGlobalPipes(new ValidationPipe(validationOptions));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    // ResolvePromisesInterceptor is used to resolve promises in responses because class-transformer can't do it
    // https://github.com/typestack/class-transformer/issues/549
    new ResolvePromisesInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.NODE_ENV !== "staging"
  ) {
    const options = new DocumentBuilder()
      .setTitle("API")
      .setDescription("API docs")
      .setVersion("1.0")
      .addCookieAuth("token")
      .addGlobalParameters({
        in: "header",
        required: false,
        name: process.env.APP_HEADER_LANGUAGE || "x-custom-lang",
        schema: {
          example: "en",
        },
      })
      .build();

    const document = SwaggerModule.createDocument(app, options);
    SwaggerModule.setup("docs", app, document);
  }

  await app.listen(configService.getOrThrow("app.port", { infer: true }));
}
void bootstrap();
