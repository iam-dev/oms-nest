import { MonitoringInterceptor } from "../../../src/monitoring/monitoring.interceptor";
import { MetricsService } from "../../../src/monitoring/metrics.service";
import {
  createMockExecutionContext,
  createMockCallHandler,
} from "../../unit/helpers/test-helpers";

describe("MonitoringInterceptor", () => {
  let interceptor: MonitoringInterceptor;
  let metricsService: jest.Mocked<MetricsService>;

  beforeEach(() => {
    metricsService = {
      incrementHttpRequests: jest.fn(),
      observeHttpDuration: jest.fn(),
    } as any;

    interceptor = new MonitoringInterceptor(metricsService);
  });

  it("should be defined", () => {
    expect(interceptor).toBeDefined();
  });

  it("should record HTTP request metrics on successful response", (done) => {
    const context = createMockExecutionContext({
      method: "GET",
      url: "/api/v1/orders",
    });

    // Add route.path to the request
    const request = context.switchToHttp().getRequest();
    request.route = { path: "/api/v1/orders" };

    const callHandler = createMockCallHandler({ data: [] });

    interceptor.intercept(context, callHandler).subscribe({
      next: () => {
        expect(metricsService.incrementHttpRequests).toHaveBeenCalledWith(
          "GET",
          "/api/v1/orders",
          200,
        );
        expect(metricsService.observeHttpDuration).toHaveBeenCalledWith(
          "GET",
          "/api/v1/orders",
          expect.any(Number),
        );
        done();
      },
      error: done.fail,
    });
  });

  it("should use request.url when route.path is not available", (done) => {
    const context = createMockExecutionContext({
      method: "POST",
      url: "/api/v1/customers",
    });

    // Ensure no route.path is set on the request
    const request = context.switchToHttp().getRequest();
    request.route = undefined;

    const callHandler = createMockCallHandler({ data: [] });

    interceptor.intercept(context, callHandler).subscribe({
      next: () => {
        expect(metricsService.incrementHttpRequests).toHaveBeenCalledWith(
          "POST",
          "/api/v1/customers",
          200,
        );
        done();
      },
      error: done.fail,
    });
  });

  it("should calculate duration in seconds", (done) => {
    const context = createMockExecutionContext({
      method: "GET",
      url: "/api/v1/orders",
    });

    const callHandler = createMockCallHandler({ data: [] });

    interceptor.intercept(context, callHandler).subscribe({
      next: () => {
        const durationArg = metricsService.observeHttpDuration.mock.calls[0][2];
        // Duration should be a number in seconds (small value since test is fast)
        expect(typeof durationArg).toBe("number");
        expect(durationArg).toBeGreaterThanOrEqual(0);
        expect(durationArg).toBeLessThan(1); // should be well under 1 second
        done();
      },
      error: done.fail,
    });
  });
});
