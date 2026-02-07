import { Module } from "@nestjs/common";
import { LeathertypeSeedService } from "./leathertype-seed.service";

@Module({
  providers: [LeathertypeSeedService],
  exports: [LeathertypeSeedService],
})
export class LeathertypeSeedModule {}
