import { Module } from "@nestjs/common";
import { CustomerSeedService } from "./customer-seed.service";

@Module({
  providers: [CustomerSeedService],
  exports: [CustomerSeedService],
})
export class CustomerSeedModule {}
