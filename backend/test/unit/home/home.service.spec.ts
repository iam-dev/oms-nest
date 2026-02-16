import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { HomeService } from "../../../src/home/home.service";

describe("HomeService", () => {
  let service: HomeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue("OMS"),
          },
        },
      ],
    }).compile();

    service = module.get<HomeService>(HomeService);
  });

  describe("appInfo", () => {
    it("should return app name from config", () => {
      const result = service.appInfo();
      expect(result).toEqual({ name: "OMS" });
    });
  });
});
