import { registerAs } from "@nestjs/config";

import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  ValidateIf,
  IsBoolean,
} from "class-validator";
import validateConfig from "../../utils/validate-config";
import { DatabaseConfig } from "./database-config.type";

class EnvironmentVariablesValidator {
  @ValidateIf((envValues) => envValues.DATABASE_URL)
  @IsString()
  DATABASE_URL: string;

  @ValidateIf((envValues) => !envValues.DATABASE_URL)
  @IsString()
  DATABASE_TYPE: string;

  @ValidateIf((envValues) => !envValues.DATABASE_URL)
  @IsString()
  DATABASE_HOST: string;

  @ValidateIf((envValues) => !envValues.DATABASE_URL)
  @IsInt()
  @Min(0)
  @Max(65535)
  DATABASE_PORT: number;

  @ValidateIf((envValues) => !envValues.DATABASE_URL)
  @IsString()
  DATABASE_PASSWORD: string;

  @ValidateIf((envValues) => !envValues.DATABASE_URL)
  @IsString()
  DATABASE_NAME: string;

  @ValidateIf((envValues) => !envValues.DATABASE_URL)
  @IsString()
  DATABASE_USERNAME: string;

  @IsBoolean()
  @IsOptional()
  DATABASE_SYNCHRONIZE: boolean;

  @IsInt()
  @IsOptional()
  DATABASE_MAX_CONNECTIONS: number;

  @IsBoolean()
  @IsOptional()
  DATABASE_SSL_ENABLED: boolean;

  @IsBoolean()
  @IsOptional()
  DATABASE_REJECT_UNAUTHORIZED: boolean;

  @IsString()
  @IsOptional()
  DATABASE_CA: string;

  @IsString()
  @IsOptional()
  DATABASE_KEY: string;

  @IsString()
  @IsOptional()
  DATABASE_CERT: string;
}

function parseDatabaseTypeFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const protocol = url.split("://")[0];
  const protocolMap: Record<string, string> = {
    postgresql: "postgres",
    postgres: "postgres",
    mysql: "mysql",
    mariadb: "mariadb",
    mongodb: "mongodb",
    "mongodb+srv": "mongodb",
    mssql: "mssql",
  };
  return protocolMap[protocol];
}

export default registerAs<DatabaseConfig>("database", () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  const type =
    process.env.DATABASE_TYPE ??
    parseDatabaseTypeFromUrl(process.env.DATABASE_URL);

  return {
    isDocumentDatabase: ["mongodb"].includes(type ?? ""),
    url: process.env.DATABASE_URL,
    type,
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT
      ? parseInt(process.env.DATABASE_PORT, 10)
      : 5432,
    password: process.env.DATABASE_PASSWORD,
    name: process.env.DATABASE_NAME,
    username: process.env.DATABASE_USERNAME,
    synchronize: process.env.DATABASE_SYNCHRONIZE === "true",
    maxConnections: process.env.DATABASE_MAX_CONNECTIONS
      ? parseInt(process.env.DATABASE_MAX_CONNECTIONS, 10)
      : 100,
    sslEnabled: process.env.DATABASE_SSL_ENABLED === "true",
    rejectUnauthorized: process.env.DATABASE_REJECT_UNAUTHORIZED === "true",
    ca: process.env.DATABASE_CA?.replace(/\\n/g, "\n"),
    key: process.env.DATABASE_KEY?.replace(/\\n/g, "\n"),
    cert: process.env.DATABASE_CERT?.replace(/\\n/g, "\n"),
  };
});
