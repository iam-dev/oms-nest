import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";

const LEATHER_TYPES = [
  { id: 1, name: "BBL - BUFFALO BLACK - Solid", sequence: 23, deleted: 0 },
  { id: 2, name: "BBR - BUFFALO BROWN - Solid", sequence: 24, deleted: 0 },
  { id: 3, name: "SBL - SMOOTH BLACK", sequence: 26, deleted: 0 },
  { id: 4, name: "SBR - SMOOTH BROWN", sequence: 27, deleted: 0 },
  { id: 5, name: "NBL - NUBUCK BLACK", sequence: 1, deleted: 0 },
  { id: 6, name: "NBR - NUBUCK BROWN", sequence: 2, deleted: 0 },
  { id: 7, name: "GBL - GRAIN BLACK", sequence: 3, deleted: 0 },
  { id: 8, name: "GBR - GRAIN BROWN", sequence: 4, deleted: 0 },
  { id: 9, name: "VBL - VELVET BLACK", sequence: 5, deleted: 0 },
  { id: 10, name: "VBR - VELVET BROWN", sequence: 6, deleted: 0 },
];

@Injectable()
export class LeathertypeSeedService {
  private readonly logger = new Logger(LeathertypeSeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async run(): Promise<void> {
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === "production") {
      this.logger.warn("Refusing to seed in production environment");
      return;
    }

    this.logger.log("Starting leathertype seed...");

    for (const lt of LEATHER_TYPES) {
      await this.dataSource.query(
        `INSERT INTO leather_types (id, name, sequence, deleted)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [lt.id, lt.name, lt.sequence, lt.deleted],
      );
    }

    this.logger.log("Leathertype seed completed!");
  }
}
