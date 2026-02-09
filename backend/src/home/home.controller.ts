import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { HomeService } from "./home.service";
import { SkipRlsContext } from "../rls/rls.guard";

@ApiTags("Home")
@SkipRlsContext()
@Controller()
export class HomeController {
  constructor(private service: HomeService) {}

  @Get()
  appInfo() {
    return this.service.appInfo();
  }
}
