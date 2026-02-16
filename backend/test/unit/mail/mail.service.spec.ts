import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { MailService } from "../../../src/mail/mail.service";
import { MailerService } from "../../../src/mailer/mailer.service";

describe("MailService", () => {
  let service: MailService;
  let mailerService: jest.Mocked<MailerService>;
  let configService: jest.Mocked<ConfigService>;

  const mockFrontendDomain = "https://app.example.com";
  const mockWorkingDirectory = "/app";
  const mockAppName = "OMS";

  beforeEach(async () => {
    const mockMailerService = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        const configs: Record<string, any> = {
          "app.name": mockAppName,
        };
        return configs[key];
      }),
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        const configs: Record<string, any> = {
          "app.frontendDomain": mockFrontendDomain,
          "app.workingDirectory": mockWorkingDirectory,
        };
        if (configs[key] === undefined) {
          throw new Error(`Config key not found: ${key}`);
        }
        return configs[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: MailerService, useValue: mockMailerService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    mailerService = module.get(MailerService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("userSignUp", () => {
    it("should send sign-up confirmation email with correct parameters", async () => {
      const mailData = {
        to: "user@example.com",
        data: { hash: "abc123" },
      };

      await service.userSignUp(mailData);

      expect(mailerService.sendMail).toHaveBeenCalledTimes(1);
      const callArgs = mailerService.sendMail.mock.calls[0][0];

      expect(callArgs.to).toBe("user@example.com");
      expect(callArgs.subject).toBe("Confirm Email");
      expect(callArgs.templatePath).toContain("activation.hbs");
      expect(callArgs.context).toEqual(
        expect.objectContaining({
          title: "Confirm Email",
          app_name: mockAppName,
          text1: expect.stringContaining("Thanks for signing up"),
        }),
      );
      // Verify URL contains the hash
      expect(callArgs.context.url).toContain("confirm-email");
      expect(callArgs.context.url).toContain("hash=abc123");
    });

    it("should construct correct URL with hash param", async () => {
      const mailData = {
        to: "user@example.com",
        data: { hash: "special-hash-value" },
      };

      await service.userSignUp(mailData);

      const callArgs = mailerService.sendMail.mock.calls[0][0];
      const url = new URL(callArgs.context.url);
      expect(url.searchParams.get("hash")).toBe("special-hash-value");
      expect(url.pathname).toBe("/confirm-email");
    });
  });

  describe("forgotPassword", () => {
    it("should send forgot password email with correct parameters", async () => {
      const mailData = {
        to: "user@example.com",
        data: { hash: "reset-hash", tokenExpires: 1700000000 },
      };

      await service.forgotPassword(mailData);

      expect(mailerService.sendMail).toHaveBeenCalledTimes(1);
      const callArgs = mailerService.sendMail.mock.calls[0][0];

      expect(callArgs.to).toBe("user@example.com");
      expect(callArgs.subject).toBe("Reset Password");
      expect(callArgs.templatePath).toContain("reset-password.hbs");
      expect(callArgs.context).toEqual(
        expect.objectContaining({
          title: "Reset Password",
          app_name: mockAppName,
        }),
      );
    });

    it("should include hash and expires in URL", async () => {
      const mailData = {
        to: "user@example.com",
        data: { hash: "reset-hash", tokenExpires: 1700000000 },
      };

      await service.forgotPassword(mailData);

      const callArgs = mailerService.sendMail.mock.calls[0][0];
      const url = new URL(callArgs.context.url);
      expect(url.searchParams.get("hash")).toBe("reset-hash");
      expect(url.searchParams.get("expires")).toBe("1700000000");
      expect(url.pathname).toBe("/password-change");
    });
  });

  describe("confirmNewEmail", () => {
    it("should send confirm new email with correct parameters", async () => {
      const mailData = {
        to: "new-email@example.com",
        data: { hash: "confirm-hash" },
      };

      await service.confirmNewEmail(mailData);

      expect(mailerService.sendMail).toHaveBeenCalledTimes(1);
      const callArgs = mailerService.sendMail.mock.calls[0][0];

      expect(callArgs.to).toBe("new-email@example.com");
      expect(callArgs.subject).toBe("Confirm New Email");
      expect(callArgs.templatePath).toContain("confirm-new-email.hbs");
      expect(callArgs.context.url).toContain("confirm-new-email");
      expect(callArgs.context.url).toContain("hash=confirm-hash");
    });
  });

  describe("orderApproved", () => {
    it("should send non-urgent order approval email", async () => {
      const mailData = {
        to: "fitter@example.com",
        data: {
          order_id: "ORD-001",
          orders_url: "https://app.example.com/orders",
          customer_name: "John Doe",
          deadline: "2024-01-15",
          brand: "default",
        },
      };

      await service.orderApproved(mailData);

      const callArgs = mailerService.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe("fitter@example.com");
      expect(callArgs.subject).toBe("Order ORD-001 Approved");
      expect(callArgs.templatePath).toContain("approved.hbs");
      expect(callArgs.templatePath).not.toContain("approved-urgent.hbs");
      expect(callArgs.brand).toBe("default");
      expect(callArgs.context).toEqual({
        order_id: "ORD-001",
        orders_url: "https://app.example.com/orders",
        customer_name: "John Doe",
        deadline: "2024-01-15",
      });
    });

    it("should send urgent order approval email with URGENT prefix", async () => {
      const mailData = {
        to: "fitter@example.com",
        data: {
          order_id: "ORD-002",
          orders_url: "https://app.example.com/orders",
          urgent: true,
          brand: "aviar",
        },
      };

      await service.orderApproved(mailData);

      const callArgs = mailerService.sendMail.mock.calls[0][0];
      expect(callArgs.subject).toBe("URGENT: Order ORD-002 Approved");
      expect(callArgs.templatePath).toContain("approved-urgent.hbs");
      expect(callArgs.brand).toBe("aviar");
    });

    it("should use non-urgent template when urgent is false", async () => {
      const mailData = {
        to: "fitter@example.com",
        data: {
          order_id: "ORD-003",
          orders_url: "https://app.example.com/orders",
          urgent: false,
        },
      };

      await service.orderApproved(mailData);

      const callArgs = mailerService.sendMail.mock.calls[0][0];
      expect(callArgs.subject).toBe("Order ORD-003 Approved");
      expect(callArgs.templatePath).toContain("approved.hbs");
      expect(callArgs.templatePath).not.toContain("approved-urgent.hbs");
    });
  });

  describe("orderChanged", () => {
    it("should send order changed email", async () => {
      const mailData = {
        to: "fitter@example.com",
        data: {
          order_id: "ORD-010",
          orders_url: "https://app.example.com/orders",
          brand: "default",
        },
      };

      await service.orderChanged(mailData);

      const callArgs = mailerService.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe("fitter@example.com");
      expect(callArgs.subject).toBe("Order ORD-010 Changed");
      expect(callArgs.templatePath).toContain("changed.hbs");
      expect(callArgs.context).toEqual({
        order_id: "ORD-010",
        orders_url: "https://app.example.com/orders",
      });
    });
  });

  describe("orderOnHold", () => {
    it("should send order on hold email with reason", async () => {
      const mailData = {
        to: "fitter@example.com",
        data: {
          order_id: "ORD-020",
          from_status: "In Production",
          order_status: "On Hold",
          reason: "Missing parts",
          brand: "default",
        },
      };

      await service.orderOnHold(mailData);

      const callArgs = mailerService.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe("fitter@example.com");
      expect(callArgs.subject).toBe("Order ORD-020 On Hold");
      expect(callArgs.templatePath).toContain("hold.hbs");
      expect(callArgs.context).toEqual({
        order_id: "ORD-020",
        from_status: "In Production",
        order_status: "On Hold",
        reason: "Missing parts",
      });
    });

    it("should handle missing optional reason", async () => {
      const mailData = {
        to: "fitter@example.com",
        data: {
          order_id: "ORD-021",
          from_status: "New",
          order_status: "On Hold",
        },
      };

      await service.orderOnHold(mailData);

      const callArgs = mailerService.sendMail.mock.calls[0][0];
      expect(callArgs.context.reason).toBeUndefined();
    });
  });

  describe("orderStatusChanged", () => {
    it("should send order status changed email", async () => {
      const mailData = {
        to: "fitter@example.com",
        data: {
          order_id: "ORD-030",
          from_status: "New",
          order_status: "In Production",
          orders_url: "https://app.example.com/orders",
          brand: "default",
        },
      };

      await service.orderStatusChanged(mailData);

      const callArgs = mailerService.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe("fitter@example.com");
      expect(callArgs.subject).toBe("Order ORD-030 Status Changed");
      expect(callArgs.templatePath).toContain("status-changed.hbs");
      expect(callArgs.context).toEqual({
        order_id: "ORD-030",
        from_status: "New",
        order_status: "In Production",
        orders_url: "https://app.example.com/orders",
      });
    });
  });

  describe("customerConfirmation", () => {
    it("should send customer confirmation email with fitter details", async () => {
      const mailData = {
        to: "customer@example.com",
        data: {
          name: "Jane Doe",
          customer_confirmation_landing_page:
            "https://app.example.com/confirm/123",
          fitter_name: "Bob Smith",
          fitter_email: "bob@example.com",
          fitter_phone: "+1234567890",
          fitter_cell: "+0987654321",
          order_id: "ORD-040",
          brand: "aviar",
        },
      };

      await service.customerConfirmation(mailData);

      const callArgs = mailerService.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe("customer@example.com");
      expect(callArgs.subject).toBe(
        "Order ORD-040 - Customer Confirmation Required",
      );
      expect(callArgs.templatePath).toContain("customer-confirmation.hbs");
      expect(callArgs.brand).toBe("aviar");
      expect(callArgs.context).toEqual({
        name: "Jane Doe",
        customer_confirmation_landing_page:
          "https://app.example.com/confirm/123",
        fitter_name: "Bob Smith",
        fitter_email: "bob@example.com",
        fitter_phone: "+1234567890",
        fitter_cell: "+0987654321",
        order_id: "ORD-040",
      });
    });
  });

  describe("newComment", () => {
    it("should send new comment notification email", async () => {
      const mailData = {
        to: "fitter@example.com",
        data: {
          user_full_name: "Admin User",
          order_id: "ORD-050",
          comment_text: "Please check the measurement",
          order_url: "https://app.example.com/orders/50",
          brand: "default",
        },
      };

      await service.newComment(mailData);

      const callArgs = mailerService.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe("fitter@example.com");
      expect(callArgs.subject).toBe("New Comment on Order ORD-050");
      expect(callArgs.templatePath).toContain("comment.hbs");
      expect(callArgs.context).toEqual({
        user_full_name: "Admin User",
        order_id: "ORD-050",
        comment_text: "Please check the measurement",
        order_url: "https://app.example.com/orders/50",
      });
    });
  });

  describe("stockRequest", () => {
    it("should send stock request email with all fields", async () => {
      const mailData = {
        to: "stock@example.com",
        data: {
          username: "fitter1",
          product_name: "Leather Saddle XL",
          product_id: "PROD-001",
          quantity: 5,
          available_stock_url: "https://app.example.com/stock/PROD-001",
          no_country_managers: true,
          country: "Germany",
          brand: "default",
        },
      };

      await service.stockRequest(mailData);

      const callArgs = mailerService.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe("stock@example.com");
      expect(callArgs.subject).toBe("Stock Request for Leather Saddle XL");
      expect(callArgs.templatePath).toContain("request-from-stock.hbs");
      expect(callArgs.brand).toBe("default");
      expect(callArgs.context).toEqual({
        username: "fitter1",
        product_name: "Leather Saddle XL",
        product_id: "PROD-001",
        quantity: 5,
        available_stock_url: "https://app.example.com/stock/PROD-001",
        no_country_managers: true,
        country: "Germany",
      });
    });

    it("should handle optional fields being undefined", async () => {
      const mailData = {
        to: "stock@example.com",
        data: {
          username: "fitter2",
          product_name: "Basic Saddle",
          product_id: "PROD-002",
          available_stock_url: "https://app.example.com/stock/PROD-002",
        },
      };

      await service.stockRequest(mailData);

      const callArgs = mailerService.sendMail.mock.calls[0][0];
      expect(callArgs.context.quantity).toBeUndefined();
      expect(callArgs.context.no_country_managers).toBeUndefined();
      expect(callArgs.context.country).toBeUndefined();
    });
  });

  describe("config usage", () => {
    it("should call configService.getOrThrow for frontendDomain", async () => {
      await service.userSignUp({
        to: "test@example.com",
        data: { hash: "h" },
      });

      expect(configService.getOrThrow).toHaveBeenCalledWith(
        "app.frontendDomain",
        { infer: true },
      );
    });

    it("should call configService.getOrThrow for workingDirectory", async () => {
      await service.userSignUp({
        to: "test@example.com",
        data: { hash: "h" },
      });

      expect(configService.getOrThrow).toHaveBeenCalledWith(
        "app.workingDirectory",
        { infer: true },
      );
    });
  });
});
