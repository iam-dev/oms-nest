import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";

const FITTERS = [
  {
    id: 1,
    userId: 24,
    deleted: 0,
    address: "Jonagoldstraat 89",
    zipcode: "6515EN",
    state: "",
    city: "Nijmegen",
    country: "Netherlands",
    phoneNo: "31612345678",
    cellNo: "",
    currency: 2,
    email: "fitter-nl@test.com",
  },
  {
    id: 2,
    userId: 28,
    deleted: 0,
    address: "123 High Street",
    zipcode: "SW1A 1AA",
    state: "",
    city: "London",
    country: "United Kingdom",
    phoneNo: "4420123456",
    cellNo: "",
    currency: 3,
    email: "fitter-gb@test.com",
  },
  {
    id: 3,
    userId: 29,
    deleted: 0,
    address: "456 Oak Ave",
    zipcode: "90210",
    state: "California",
    city: "Los Angeles",
    country: "United States",
    phoneNo: "3101234567",
    cellNo: "",
    currency: 1,
    email: "fitter-us@test.com",
  },
  {
    id: 4,
    userId: 30,
    deleted: 0,
    address: "789 Maple Rd",
    zipcode: "K1A 0B1",
    state: "Ontario",
    city: "Ottawa",
    country: "Canada",
    phoneNo: "6131234567",
    cellNo: "",
    currency: 4,
    email: "fitter-ca@test.com",
  },
  {
    id: 5,
    userId: 31,
    deleted: 0,
    address: "10 Harbour St",
    zipcode: "2000",
    state: "NSW",
    city: "Sydney",
    country: "Australia",
    phoneNo: "61299876543",
    cellNo: "",
    currency: 5,
    email: "fitter-au@test.com",
  },
];

@Injectable()
export class FitterSeedService {
  private readonly logger = new Logger(FitterSeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async run(): Promise<void> {
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === "production") {
      this.logger.warn("Refusing to seed in production environment");
      return;
    }

    this.logger.log("Starting fitter seed...");

    for (const f of FITTERS) {
      await this.dataSource.query(
        `INSERT INTO fitters (id, user_id, deleted, address, zipcode, state, city, country, phone_no, cell_no, currency, emailaddress)
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

    this.logger.log("Fitter seed completed!");
  }
}
