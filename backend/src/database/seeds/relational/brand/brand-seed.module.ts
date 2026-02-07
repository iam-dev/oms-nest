import { Module } from "@nestjs/common";
import { BrandSeedService } from "./brand-seed.service";

@Module({
  providers: [BrandSeedService],
  exports: [BrandSeedService],
})
export class BrandSeedModule {}
