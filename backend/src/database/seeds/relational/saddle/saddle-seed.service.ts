import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";

const SADDLES = [
  {
    id: 1,
    factoryEu: 3,
    factoryGb: 2,
    factoryUs: 1,
    brand: "Custom",
    modelName: "Custom Advantage",
    presets: "",
    active: 1,
    type: 0,
    deleted: 0,
    sequence: 1,
    factoryCa: 4,
    factoryAud: null,
    factoryDe: null,
    factoryNl: null,
  },
  {
    id: 2,
    factoryEu: 3,
    factoryGb: 2,
    factoryUs: 1,
    brand: "Custom",
    modelName: "Custom Eclipse",
    presets: "",
    active: 1,
    type: 0,
    deleted: 0,
    sequence: 2,
    factoryCa: 4,
    factoryAud: null,
    factoryDe: null,
    factoryNl: null,
  },
  {
    id: 3,
    factoryEu: 3,
    factoryGb: 2,
    factoryUs: 1,
    brand: "Icon",
    modelName: "Icon Flight",
    presets: "",
    active: 1,
    type: 0,
    deleted: 0,
    sequence: 3,
    factoryCa: 4,
    factoryAud: null,
    factoryDe: null,
    factoryNl: null,
  },
  {
    id: 4,
    factoryEu: 3,
    factoryGb: 2,
    factoryUs: 1,
    brand: "Icon",
    modelName: "Icon Spirit",
    presets: "",
    active: 1,
    type: 0,
    deleted: 0,
    sequence: 4,
    factoryCa: 4,
    factoryAud: null,
    factoryDe: null,
    factoryNl: null,
  },
  {
    id: 5,
    factoryEu: 3,
    factoryGb: 2,
    factoryUs: 1,
    brand: "Wolfgang",
    modelName: "Wolfgang Solo",
    presets: "",
    active: 1,
    type: 1,
    deleted: 0,
    sequence: 5,
    factoryCa: 4,
    factoryAud: null,
    factoryDe: null,
    factoryNl: null,
  },
  {
    id: 6,
    factoryEu: 3,
    factoryGb: 2,
    factoryUs: 1,
    brand: "Wolfgang",
    modelName: "Wolfgang Duo",
    presets: "",
    active: 1,
    type: 1,
    deleted: 0,
    sequence: 6,
    factoryCa: 4,
    factoryAud: null,
    factoryDe: null,
    factoryNl: null,
  },
  {
    id: 7,
    factoryEu: 3,
    factoryGb: 2,
    factoryUs: 1,
    brand: "Custom",
    modelName: "Custom Legacy",
    presets: "",
    active: 0,
    type: 0,
    deleted: 1,
    sequence: 7,
    factoryCa: 4,
    factoryAud: null,
    factoryDe: null,
    factoryNl: null,
  },
  {
    id: 8,
    factoryEu: 3,
    factoryGb: 2,
    factoryUs: 1,
    brand: "Icon",
    modelName: "Icon Horizon",
    presets: "",
    active: 1,
    type: 0,
    deleted: 0,
    sequence: 8,
    factoryCa: 4,
    factoryAud: null,
    factoryDe: null,
    factoryNl: null,
  },
];

@Injectable()
export class SaddleSeedService {
  private readonly logger = new Logger(SaddleSeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async run(): Promise<void> {
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === "production") {
      this.logger.warn("Refusing to seed in production environment");
      return;
    }

    this.logger.log("Starting saddle seed...");

    for (const s of SADDLES) {
      await this.dataSource.query(
        `INSERT INTO saddles (id, factory_eu, factory_gb, factory_us, brand, model_name, presets, active, type, deleted, sequence, factory_ca, factory_aud, factory_de, factory_nl)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (id) DO NOTHING`,
        [
          s.id,
          s.factoryEu,
          s.factoryGb,
          s.factoryUs,
          s.brand,
          s.modelName,
          s.presets,
          s.active,
          s.type,
          s.deleted,
          s.sequence,
          s.factoryCa,
          s.factoryAud,
          s.factoryDe,
          s.factoryNl,
        ],
      );
    }

    this.logger.log("Saddle seed completed!");
  }
}
