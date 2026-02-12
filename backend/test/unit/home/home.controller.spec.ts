import { Test, TestingModule } from "@nestjs/testing";
import { HomeController } from "../../../src/home/home.controller";
import { HomeService } from "../../../src/home/home.service";

describe("HomeController", () => {
  let controller: HomeController;
  let homeService: jest.Mocked<HomeService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HomeController],
      providers: [
        {
          provide: HomeService,
          useValue: {
            appInfo: jest.fn().mockReturnValue({ name: "OMS" }),
          },
        },
      ],
    }).compile();

    controller = module.get<HomeController>(HomeController);
    homeService = module.get(HomeService);
  });

  describe("appInfo", () => {
    it("should return app info from service", () => {
      const result = controller.appInfo();

      expect(result).toEqual({ name: "OMS" });
      expect(homeService.appInfo).toHaveBeenCalled();
    });
  });
});
