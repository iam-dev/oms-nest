import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";

const BRANDS = [
  { id: 1, brandName: "Custom" },
  { id: 2, brandName: "Icon" },
  { id: 3, brandName: "Wolfgang" },
];

@Injectable()
export class BrandSeedService {
  private readonly logger = new Logger(BrandSeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async run(): Promise<void> {
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === "production") {
      this.logger.warn("Refusing to seed in production environment");
      return;
    }

    this.logger.log("Starting brand seed...");

    for (const brand of BRANDS) {
      await this.dataSource.query(
        `INSERT INTO brands (id, brand_name)
         VALUES ($1, $2)
         ON CONFLICT (id) DO NOTHING`,
        [brand.id, brand.brandName],
      );
    }

    this.logger.log("Brand seed completed!");
  }
}
