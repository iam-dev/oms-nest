import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";

const FACTORIES = [
  {
    id: 1,
    userId: 15,
    deleted: 0,
    address: "127 Main St",
    zipcode: "29801",
    state: "South Carolina",
    city: "Aiken",
    country: "United States",
    phoneNo: "803649276",
    cellNo: "",
    currency: 1,
    email: "factory-us@test.com",
  },
  {
    id: 2,
    userId: 20,
    deleted: 0,
    address: "Unit 7 Hawkins Dr",
    zipcode: "WS11 0XU",
    state: "",
    city: "Cheslyn Hay",
    country: "United Kingdom",
    phoneNo: "+4419224152",
    cellNo: "",
    currency: 3,
    email: "factory-gb@test.com",
  },
  {
    id: 3,
    userId: 21,
    deleted: 0,
    address: "Zonnedauw 12",
    zipcode: "5688GR",
    state: "",
    city: "Oirschot",
    country: "Netherlands",
    phoneNo: "+31499573",
    cellNo: "",
    currency: 2,
    email: "factory-eu@test.com",
  },
  {
    id: 4,
    userId: 22,
    deleted: 0,
    address: "PO Box 456",
    zipcode: "V1Y2R3",
    state: "British Columbia",
    city: "Kelowna",
    country: "Canada",
    phoneNo: "2501234567",
    cellNo: "",
    currency: 4,
    email: "factory-ca@test.com",
  },
];

@Injectable()
export class FactorySeedService {
  private readonly logger = new Logger(FactorySeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async run(): Promise<void> {
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === "production") {
      this.logger.warn("Refusing to seed in production environment");
      return;
    }

    this.logger.log("Starting factory seed...");

    for (const f of FACTORIES) {
      await this.dataSource.query(
        `INSERT INTO factories (id, user_id, deleted, address, zipcode, state, city, country, phone_no, cell_no, currency, emailaddress)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        [
          f.id,
          f.userId,
          f.deleted,
          f.address,
          f.zipcode,
          f.state,
          f.city,
          f.country,
          f.phoneNo,
          f.cellNo,
          f.currency,
          f.email,
        ],
      );
    }

    this.logger.log("Factory seed completed!");
  }
}
