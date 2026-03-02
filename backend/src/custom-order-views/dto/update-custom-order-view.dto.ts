import { PartialType } from "@nestjs/swagger";
import { CreateCustomOrderViewDto } from "./create-custom-order-view.dto";

export class UpdateCustomOrderViewDto extends PartialType(
  CreateCustomOrderViewDto,
) {}
