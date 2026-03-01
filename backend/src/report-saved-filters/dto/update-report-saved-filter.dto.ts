import { PartialType } from "@nestjs/swagger";
import { CreateReportSavedFilterDto } from "./create-report-saved-filter.dto";

export class UpdateReportSavedFilterDto extends PartialType(
  CreateReportSavedFilterDto,
) {}
