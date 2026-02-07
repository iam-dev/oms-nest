import { Module } from "@nestjs/common";
import { FitterSeedService } from "./fitter-seed.service";

@Module({
  providers: [FitterSeedService],
  exports: [FitterSeedService],
})
export class FitterSeedModule {}
