import { PartialType } from "@nestjs/swagger";
import { CreateCustomOrderViewGroupDto } from "./create-custom-order-view-group.dto";

export class UpdateCustomOrderViewGroupDto extends PartialType(
  CreateCustomOrderViewGroupDto,
) {}
