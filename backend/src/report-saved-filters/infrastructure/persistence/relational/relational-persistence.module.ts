import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ReportSavedFilterEntity } from "./entities/report-saved-filter.entity";
import { ReportSavedFilterRepository } from "./repositories/report-saved-filter.repository";

@Module({
  imports: [TypeOrmModule.forFeature([ReportSavedFilterEntity])],
  providers: [ReportSavedFilterRepository],
  exports: [ReportSavedFilterRepository],
})
export class ReportSavedFilterRelationalPersistenceModule {}
