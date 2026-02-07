import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";

const CUSTOMERS = [
  // Fitter 1 (NL)
  {
    id: 1,
    deleted: 0,
    fitterId: 1,
    horseName: "Orion",
    name: "Jan van der Berg",
    address: "Kerkstraat 12",
    company: "",
    city: "Nijmegen",
    country: "Netherlands",
    state: "",
    zipcode: "6511AA",
    email: "jan.vdberg@test.com",
    phoneNo: "31612345001",
    cellNo: "",
    bankAccount: "",
  },
  {
    id: 2,
    deleted: 0,
    fitterId: 1,
    horseName: "Luna",
    name: "Emma de Vries",
    address: "Dorpsstraat 45",
    company: "De Vries Stables",
    city: "Arnhem",
    country: "Netherlands",
    state: "",
    zipcode: "6811AB",
    email: "emma.devries@test.com",
    phoneNo: "31612345002",
    cellNo: "",
    bankAccount: "",
  },
  // Fitter 2 (GB)
  {
    id: 3,
    deleted: 0,
    fitterId: 2,
    horseName: "Thunder",
    name: "James Wilson",
    address: "42 Baker Street",
    company: "",
    city: "London",
    country: "United Kingdom",
    state: "",
    zipcode: "NW1 6XE",
    email: "james.wilson@test.com",
    phoneNo: "4420123001",
    cellNo: "",
    bankAccount: "",
  },
  {
    id: 4,
    deleted: 0,
    fitterId: 2,
    horseName: "Starlight",
    name: "Sophie Clarke",
    address: "8 Victoria Road",
    company: "Clarke Equestrian",
    city: "Manchester",
    country: "United Kingdom",
    state: "",
    zipcode: "M1 1AA",
    email: "sophie.clarke@test.com",
    phoneNo: "4420123002",
    cellNo: "",
    bankAccount: "",
  },
  // Fitter 3 (US)
  {
    id: 5,
    deleted: 0,
    fitterId: 3,
    horseName: "Maverick",
    name: "Emily Johnson",
    address: "789 Sunset Blvd",
    company: "",
    city: "Los Angeles",
    country: "United States",
    state: "California",
    zipcode: "90028",
    email: "emily.johnson@test.com",
    phoneNo: "3101234001",
    cellNo: "",
    bankAccount: "",
  },
  {
    id: 6,
    deleted: 0,
    fitterId: 3,
    horseName: "Dakota",
    name: "Michael Brown",
    address: "321 Ranch Road",
    company: "Brown Ranch",
    city: "Aiken",
    country: "United States",
    state: "South Carolina",
    zipcode: "29801",
    email: "michael.brown@test.com",
    phoneNo: "8031234001",
    cellNo: "",
    bankAccount: "",
  },
  // Fitter 4 (CA)
  {
    id: 7,
    deleted: 0,
    fitterId: 4,
    horseName: "Maple",
    name: "Sarah Tremblay",
    address: "456 Rideau St",
    company: "",
    city: "Ottawa",
    country: "Canada",
    state: "Ontario",
    zipcode: "K1N 5Y2",
    email: "sarah.tremblay@test.com",
    phoneNo: "6131234001",
    cellNo: "",
    bankAccount: "",
  },
  {
    id: 8,
    deleted: 0,
    fitterId: 4,
    horseName: "Blizzard",
    name: "David Chen",
    address: "123 Elgin St",
    company: "Chen Equine",
    city: "Ottawa",
    country: "Canada",
    state: "Ontario",
    zipcode: "K2P 1L4",
    email: "david.chen@test.com",
    phoneNo: "6131234002",
    cellNo: "",
    bankAccount: "",
  },
  // Fitter 5 (AU)
  {
    id: 9,
    deleted: 0,
    fitterId: 5,
    horseName: "Boomer",
    name: "Jack Murray",
    address: "55 George St",
    company: "",
    city: "Sydney",
    country: "Australia",
    state: "NSW",
    zipcode: "2000",
    email: "jack.murray@test.com",
    phoneNo: "61299876001",
    cellNo: "",
    bankAccount: "",
  },
  {
    id: 10,
    deleted: 1,
    fitterId: 5,
    horseName: "Wattle",
    name: "Lisa Taylor",
    address: "10 Pitt St",
    company: "Taylor Stables",
    city: "Sydney",
    country: "Australia",
    state: "NSW",
    zipcode: "2000",
    email: "lisa.taylor@test.com",
    phoneNo: "61299876002",
    cellNo: "",
    bankAccount: "",
  },
];

@Injectable()
export class CustomerSeedService {
  private readonly logger = new Logger(CustomerSeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async run(): Promise<void> {
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === "production") {
      this.logger.warn("Refusing to seed in production environment");
      return;
    }

    this.logger.log("Starting customer seed...");

    for (const c of CUSTOMERS) {
      await this.dataSource.query(
        `INSERT INTO customers (id, deleted, fitter_id, horse_name, name, address, company, city, country, state, zipcode, email, phone_no, cell_no, bank_account_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (id) DO NOTHING`,
        [
          c.id,
          c.deleted,
          c.fitterId,
          c.horseName,
          c.name,
          c.address,
          c.company,
          c.city,
          c.country,
          c.state,
          c.zipcode,
          c.email,
          c.phoneNo,
          c.cellNo,
          c.bankAccount,
        ],
      );
    }

    this.logger.log("Customer seed completed!");
  }
}
