import { Module } from "@nestjs/common";
import { SaddleSeedService } from "./saddle-seed.service";

@Module({
  providers: [SaddleSeedService],
  exports: [SaddleSeedService],
})
export class SaddleSeedModule {}
