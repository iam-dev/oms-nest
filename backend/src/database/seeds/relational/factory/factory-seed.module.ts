import { Module } from "@nestjs/common";
import { FactorySeedService } from "./factory-seed.service";

@Module({
  providers: [FactorySeedService],
  exports: [FactorySeedService],
})
export class FactorySeedModule {}
