import { Injectable } from "@nestjs/common";
import fs from "node:fs/promises";
import path from "node:path";
import { ConfigService } from "@nestjs/config";
import nodemailer, { type SendMailOptions, type Transporter } from "nodemailer";
import Handlebars from "handlebars";
import { AllConfigType } from "../config/config.type";

@Injectable()
export class MailerService {
  private readonly transporter: Transporter;
  private readonly mailgunTransporter?: Transporter;

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    // Default SMTP/localhost transporter
    this.transporter = nodemailer.createTransport({
      host: configService.get("mail.host", { infer: true }),
      port: configService.get("mail.port", { infer: true }),
      ignoreTLS: configService.get("mail.ignoreTLS", { infer: true }),
      secure: configService.get("mail.secure", { infer: true }),
      requireTLS: configService.get("mail.requireTLS", { infer: true }),
      auth: {
        user: configService.get("mail.user", { infer: true }),
        pass: configService.get("mail.password", { infer: true }),
      },
    });

    // Mailgun transporter (if configured)
    const mailgunConfig = configService.get("mail.mailgun", { infer: true });
    if (mailgunConfig?.apiKey && mailgunConfig?.domainOrderMySaddle) {
      // Use SMTP for Mailgun integration
      this.mailgunTransporter = nodemailer.createTransport({
        host: "smtp.mailgun.org",
        port: 587,
        secure: false,
        auth: {
          user: `postmaster@${mailgunConfig.domainOrderMySaddle}`,
          pass: mailgunConfig.apiKey,
        },
      });
    }
  }

  private getTransporter(_brand?: string): Transporter {
    void _brand;
    // Use Mailgun for production, localhost for development
    if (this.mailgunTransporter && process.env.NODE_ENV === "production") {
      return this.mailgunTransporter;
    }
    return this.transporter;
  }

  private getFromEmail(brand?: string): string {
    const mailgunConfig = this.configService.get("mail.mailgun", {
      infer: true,
    });

    if (this.mailgunTransporter && process.env.NODE_ENV === "production") {
      if (brand === "aviar" && mailgunConfig?.domainAviar) {
        return `"Aviar Saddles" <noreply@${mailgunConfig.domainAviar}>`;
      }
      if (mailgunConfig?.domainOrderMySaddle) {
        return `"Custom Saddlery" <noreply@${mailgunConfig.domainOrderMySaddle}>`;
      }
    }

    // Fallback to configured default
    return `"${this.configService.get("mail.defaultName", {
      infer: true,
    })}" <${this.configService.get("mail.defaultEmail", {
      infer: true,
    })}>`;
  }

  async sendMail({
    templatePath,
    context,
    brand,
    ...mailOptions
  }: SendMailOptions & {
    templatePath: string;
    context: Record<string, unknown>;
    brand?: string;
  }): Promise<void> {
    let html: string | undefined;
    if (templatePath) {
      const template = await fs.readFile(templatePath, "utf-8");

      // Determine brand for base template selection
      const brandType = brand === "aviar" ? "aviar" : "default";
      const baseTemplatePath = path.join(
        this.configService.getOrThrow("app.workingDirectory", { infer: true }),
        "src",
        "mail",
        "mail-templates",
        "base",
        `base-${brandType}.hbs`,
      );

      // Read base template
      const baseTemplate = await fs.readFile(baseTemplatePath, "utf-8");

      // Compile content template
      const contentHtml = Handlebars.compile(template, { strict: true })(
        context,
      );

      // Compile base template with content
      const contextWithContent = {
        ...context,
        body: contentHtml,
        app_url: this.configService.get("app.frontendDomain", { infer: true }),
        app_name: this.configService.get("app.name", { infer: true }),
        brand: brandType,
      };

      html = Handlebars.compile(baseTemplate, { strict: true })(
        contextWithContent,
      );
    }

    // Select the appropriate transporter and from email
    const transporter = this.getTransporter(brand);
    const fromEmail = mailOptions.from || this.getFromEmail(brand);

    await transporter.sendMail({
      ...mailOptions,
      from: fromEmail,
      html: mailOptions.html ? mailOptions.html : html,
    });
  }
}
