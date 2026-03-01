import { Module } from "@nestjs/common";
import { ReportSavedFilterService } from "./report-saved-filter.service";
import { ReportSavedFilterController } from "./report-saved-filter.controller";
import { ReportSavedFilterRelationalPersistenceModule } from "./infrastructure/persistence/relational/relational-persistence.module";

@Module({
  imports: [ReportSavedFilterRelationalPersistenceModule],
  controllers: [ReportSavedFilterController],
  providers: [ReportSavedFilterService],
  exports: [ReportSavedFilterService],
})
export class ReportSavedFilterModule {}
