import { Test, TestingModule } from "@nestjs/testing";
import { MetricsController } from "../../../src/monitoring/metrics.controller";
import { MetricsService } from "../../../src/monitoring/metrics.service";

describe("MetricsController", () => {
  let controller: MetricsController;
  let metricsService: jest.Mocked<MetricsService>;

  beforeEach(async () => {
    const mockMetricsService = {
      getMetrics: jest
        .fn()
        .mockResolvedValue(
          "# HELP http_requests_total Total number of HTTP requests\n" +
            "# TYPE http_requests_total counter\n",
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [{ provide: MetricsService, useValue: mockMetricsService }],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
    metricsService = module.get(MetricsService);
  });

  describe("getMetrics", () => {
    it("should return metrics string from service", async () => {
      const result = await controller.getMetrics();

      expect(metricsService.getMetrics).toHaveBeenCalledTimes(1);
      expect(typeof result).toBe("string");
      expect(result).toContain("http_requests_total");
    });
  });
});
