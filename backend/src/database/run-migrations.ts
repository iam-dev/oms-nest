/**
 * Standalone migration runner for production containers.
 *
 * Usage:  node dist/src/database/run-migrations.js
 *
 * Uses __dirname to resolve compiled migration files, so it works
 * in the production image where only dist/ exists.
 */
import "reflect-metadata";
import { DataSource } from "typeorm";
import path from "path";

async function runMigrations() {
  const dataSource = new DataSource({
    type: (process.env.DATABASE_TYPE as "postgres") || "postgres",
    url: process.env.DATABASE_URL,
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT
      ? parseInt(process.env.DATABASE_PORT, 10)
      : 5432,
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    migrations: [path.join(__dirname, "migrations", "*{.ts,.js}")],
    migrationsTableName: "migrations",
    extra: {
      ssl:
        process.env.DATABASE_SSL_ENABLED === "true"
          ? {
              rejectUnauthorized:
                process.env.DATABASE_REJECT_UNAUTHORIZED === "true",
              ca: process.env.DATABASE_CA?.replace(/\\n/g, "\n") ?? undefined,
              key: process.env.DATABASE_KEY?.replace(/\\n/g, "\n") ?? undefined,
              cert:
                process.env.DATABASE_CERT?.replace(/\\n/g, "\n") ?? undefined,
            }
          : undefined,
    },
  });

  await dataSource.initialize();

  const pending = await dataSource.showMigrations();

  if (!pending) {
    console.log("No pending migrations. Database is up to date.");
    await dataSource.destroy();
    return;
  }

  console.log("Pending migrations found. Running...");
  const executed = await dataSource.runMigrations();
  console.log(
    `Executed ${executed.length} migration(s):`,
    executed.map((m) => m.name),
  );

  await dataSource.destroy();
}

runMigrations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
