import { ConfigService } from "@nestjs/config";
import { MailerService } from "../../../src/mailer/mailer.service";
import nodemailer from "nodemailer";
import fs from "node:fs/promises";

jest.mock("nodemailer");
jest.mock("node:fs/promises");

describe("MailerService", () => {
  let service: MailerService;
  let mockSendMail: jest.Mock;
  let mockMailgunSendMail: jest.Mock;
  let configService: jest.Mocked<ConfigService>;

  const defaultMailConfig = {
    "mail.host": "localhost",
    "mail.port": 1025,
    "mail.ignoreTLS": true,
    "mail.secure": false,
    "mail.requireTLS": false,
    "mail.user": "testuser",
    "mail.password": "testpass",
    "mail.defaultName": "Test App",
    "mail.defaultEmail": "noreply@test.com",
    "mail.mailgun": null,
    "app.workingDirectory": "/app",
    "app.frontendDomain": "https://app.test.com",
    "app.name": "TestApp",
    "app.apiPrefix": "api",
  };

  beforeEach(() => {
    mockSendMail = jest.fn().mockResolvedValue({ messageId: "test-id" });
    mockMailgunSendMail = jest.fn().mockResolvedValue({ messageId: "mg-id" });

    (nodemailer.createTransport as jest.Mock).mockImplementation((config) => {
      if (config?.host === "smtp.mailgun.org") {
        return { sendMail: mockMailgunSendMail };
      }
      return { sendMail: mockSendMail };
    });

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        return defaultMailConfig[key];
      }),
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        const val = defaultMailConfig[key];
        if (val === undefined) throw new Error(`Missing: ${key}`);
        return val;
      }),
    } as any;

    service = new MailerService(configService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Restore NODE_ENV
    delete process.env.NODE_ENV;
  });

  describe("constructor", () => {
    it("should create default transporter", () => {
      expect(nodemailer.createTransport).toHaveBeenCalled();
    });

    it("should create mailgun transporter when configured", () => {
      configService.get.mockImplementation((key: string) => {
        if (key === "mail.mailgun") {
          return {
            apiKey: "test-api-key",
            domainOrderMySaddle: "mg.example.com",
          };
        }
        return defaultMailConfig[key];
      });

      const serviceWithMailgun = new MailerService(configService);
      expect(serviceWithMailgun).toBeDefined();
      // Should have called createTransport twice (default + mailgun)
      expect(nodemailer.createTransport).toHaveBeenCalledTimes(3); // 1 from beforeEach + 2 from this test
    });

    it("should not create mailgun transporter when apiKey is missing", () => {
      configService.get.mockImplementation((key: string) => {
        if (key === "mail.mailgun") {
          return { apiKey: null, domainOrderMySaddle: "mg.example.com" };
        }
        return defaultMailConfig[key];
      });

      new MailerService(configService);
      // Only default transporter created (1 from beforeEach + 1 here)
      expect(nodemailer.createTransport).toHaveBeenCalledTimes(2);
    });
  });

  describe("sendMail", () => {
    it("should compile template and send email", async () => {
      const mockTemplate = "<h1>{{title}}</h1><p>{{body}}</p>";
      const mockBaseTemplate = "<html><body>{{{body}}}</body></html>";

      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce(mockTemplate) // Content template
        .mockResolvedValueOnce(mockBaseTemplate); // Base template

      await service.sendMail({
        to: "user@test.com",
        subject: "Test Subject",
        templatePath: "/app/src/mail/mail-templates/test.hbs",
        context: {
          title: "Hello",
          body: "World",
        },
      });

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.to).toBe("user@test.com");
      expect(callArgs.subject).toBe("Test Subject");
      expect(callArgs.html).toBeDefined();
    });

    it("should use default from email in non-production", async () => {
      const mockTemplate = "{{title}}";
      const mockBaseTemplate = "{{{body}}}";

      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockBaseTemplate);

      await service.sendMail({
        to: "user@test.com",
        subject: "Test",
        templatePath: "/app/template.hbs",
        context: { title: "Hi" },
      });

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.from).toContain("Test App");
      expect(callArgs.from).toContain("noreply@test.com");
    });

    it("should use provided from email when specified", async () => {
      const mockTemplate = "{{title}}";
      const mockBaseTemplate = "{{{body}}}";

      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockBaseTemplate);

      await service.sendMail({
        to: "user@test.com",
        from: "custom@sender.com",
        subject: "Test",
        templatePath: "/app/template.hbs",
        context: { title: "Hi" },
      });

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.from).toBe("custom@sender.com");
    });

    it("should use aviar base template when brand is aviar", async () => {
      const mockTemplate = "{{title}}";
      const mockBaseTemplate = "{{{body}}}";

      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockBaseTemplate);

      await service.sendMail({
        to: "user@test.com",
        subject: "Test",
        templatePath: "/app/template.hbs",
        context: { title: "Hi" },
        brand: "aviar",
      });

      const baseTemplatePath = (fs.readFile as jest.Mock).mock.calls[1][0];
      expect(baseTemplatePath).toContain("base-aviar.hbs");
    });

    it("should use default base template for non-aviar brands", async () => {
      const mockTemplate = "{{title}}";
      const mockBaseTemplate = "{{{body}}}";

      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockBaseTemplate);

      await service.sendMail({
        to: "user@test.com",
        subject: "Test",
        templatePath: "/app/template.hbs",
        context: { title: "Hi" },
        brand: "default",
      });

      const baseTemplatePath = (fs.readFile as jest.Mock).mock.calls[1][0];
      expect(baseTemplatePath).toContain("base-default.hbs");
    });

    it("should prefer existing html over compiled template", async () => {
      const mockTemplate = "{{title}}";
      const mockBaseTemplate = "{{{body}}}";

      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockBaseTemplate);

      await service.sendMail({
        to: "user@test.com",
        subject: "Test",
        html: "<p>Pre-rendered HTML</p>",
        templatePath: "/app/template.hbs",
        context: { title: "Hi" },
      });

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toBe("<p>Pre-rendered HTML</p>");
    });
  });
});
