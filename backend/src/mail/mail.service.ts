import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MailData } from "./interfaces/mail-data.interface";

import { MailerService } from "../mailer/mailer.service";
import path from "path";
import { AllConfigType } from "../config/config.type";

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async userSignUp(mailData: MailData<{ hash: string }>): Promise<void> {
    const emailConfirmTitle = "Confirm Email";
    const text1 =
      "Thanks for signing up! To complete your registration, please click the link below to verify your email address.";
    const text2 =
      "If you did not sign up for this account you can ignore this email and the account will be deleted.";
    const text3 = "This confirmation link will expire in 24 hours.";

    const url = new URL(
      this.configService.getOrThrow("app.frontendDomain", {
        infer: true,
      }) + "/confirm-email",
    );
    url.searchParams.set("hash", mailData.data.hash);

    await this.mailerService.sendMail({
      to: mailData.to,
      subject: emailConfirmTitle,
      text: `${url.toString()} ${emailConfirmTitle}`,
      templatePath: path.join(
        this.configService.getOrThrow("app.workingDirectory", {
          infer: true,
        }),
        "src",
        "mail",
        "mail-templates",
        "activation.hbs",
      ),
      context: {
        title: emailConfirmTitle,
        url: url.toString(),
        actionTitle: emailConfirmTitle,
        app_name: this.configService.get("app.name", { infer: true }),
        text1,
        text2,
        text3,
      },
    });
  }

  async forgotPassword(
    mailData: MailData<{ hash: string; tokenExpires: number }>,
  ): Promise<void> {
    const resetPasswordTitle = "Reset Password";
    const text1 =
      "You are receiving this email because you (or someone else) have requested the reset of the password for your account.";
    const text2 =
      "Please click on the following link, or paste this into your browser to complete the process:";
    const text3 =
      "If you did not request this, please ignore this email and your password will remain unchanged.";
    const text4 = "This reset link will expire in 30 minutes.";

    const url = new URL(
      this.configService.getOrThrow("app.frontendDomain", {
        infer: true,
      }) + "/password-change",
    );
    url.searchParams.set("hash", mailData.data.hash);
    url.searchParams.set("expires", mailData.data.tokenExpires.toString());

    await this.mailerService.sendMail({
      to: mailData.to,
      subject: resetPasswordTitle,
      text: `${url.toString()} ${resetPasswordTitle}`,
      templatePath: path.join(
        this.configService.getOrThrow("app.workingDirectory", {
          infer: true,
        }),
        "src",
        "mail",
        "mail-templates",
        "reset-password.hbs",
      ),
      context: {
        title: resetPasswordTitle,
        url: url.toString(),
        actionTitle: resetPasswordTitle,
        app_name: this.configService.get("app.name", {
          infer: true,
        }),
        text1,
        text2,
        text3,
        text4,
      },
    });
  }

  async confirmNewEmail(mailData: MailData<{ hash: string }>): Promise<void> {
    const emailConfirmTitle = "Confirm New Email";
    const text1 = "You have requested to change your email address.";
    const text2 =
      "Please click the link below to confirm your new email address:";
    const text3 = "This confirmation link will expire in 24 hours.";

    const url = new URL(
      this.configService.getOrThrow("app.frontendDomain", {
        infer: true,
      }) + "/confirm-new-email",
    );
    url.searchParams.set("hash", mailData.data.hash);

    await this.mailerService.sendMail({
      to: mailData.to,
      subject: emailConfirmTitle,
      text: `${url.toString()} ${emailConfirmTitle}`,
      templatePath: path.join(
        this.configService.getOrThrow("app.workingDirectory", {
          infer: true,
        }),
        "src",
        "mail",
        "mail-templates",
        "confirm-new-email.hbs",
      ),
      context: {
        title: emailConfirmTitle,
        url: url.toString(),
        actionTitle: emailConfirmTitle,
        app_name: this.configService.get("app.name", { infer: true }),
        text1,
        text2,
        text3,
      },
    });
  }

  async welcomeFitter(
    mailData: MailData<{ hash: string; tokenExpires: number }>,
  ): Promise<void> {
    const title = "Welcome to Order My Saddle";
    const text1 =
      "An account has been created for you. To get started, please set your password by clicking the link below.";
    const text2 = "This will allow you to log in and manage your orders.";
    const text3 = "If you did not expect this email, please ignore it.";
    const text4 = "This link will expire in 30 minutes.";

    const url = new URL(
      this.configService.getOrThrow("app.frontendDomain", {
        infer: true,
      }) + "/password-change",
    );
    url.searchParams.set("hash", mailData.data.hash);
    url.searchParams.set("expires", mailData.data.tokenExpires.toString());

    await this.mailerService.sendMail({
      to: mailData.to,
      subject: title,
      text: `${url.toString()} ${title}`,
      templatePath: path.join(
        this.configService.getOrThrow("app.workingDirectory", {
          infer: true,
        }),
        "src",
        "mail",
        "mail-templates",
        "account",
        "welcome-fitter.hbs",
      ),
      context: {
        title,
        url: url.toString(),
        actionTitle: "Set Your Password",
        app_name: this.configService.get("app.name", { infer: true }),
        text1,
        text2,
        text3,
        text4,
      },
    });
  }

  // OMS Business Logic Email Methods

  async orderApproved(
    mailData: MailData<{
      order_id: string;
      orders_url: string;
      urgent?: boolean;
      customer_name?: string;
      deadline?: string;
      brand?: string;
    }>,
  ): Promise<void> {
    const template = mailData.data.urgent
      ? "approved-urgent.hbs"
      : "approved.hbs";
    const subject = mailData.data.urgent
      ? `URGENT: Order ${mailData.data.order_id} Approved`
      : `Order ${mailData.data.order_id} Approved`;

    await this.mailerService.sendMail({
      to: mailData.to,
      subject,
      templatePath: path.join(
        this.configService.getOrThrow("app.workingDirectory", { infer: true }),
        "src",
        "mail",
        "mail-templates",
        "notifications",
        template,
      ),
      brand: mailData.data.brand,
      context: {
        order_id: mailData.data.order_id,
        orders_url: mailData.data.orders_url,
        customer_name: mailData.data.customer_name,
        deadline: mailData.data.deadline,
      },
    });
  }

  async orderChanged(
    mailData: MailData<{
      order_id: string;
      orders_url: string;
      brand?: string;
    }>,
  ): Promise<void> {
    const subject = `Order ${mailData.data.order_id} Changed`;

    await this.mailerService.sendMail({
      to: mailData.to,
      subject,
      templatePath: path.join(
        this.configService.getOrThrow("app.workingDirectory", { infer: true }),
        "src",
        "mail",
        "mail-templates",
        "notifications",
        "changed.hbs",
      ),
      brand: mailData.data.brand,
      context: {
        order_id: mailData.data.order_id,
        orders_url: mailData.data.orders_url,
      },
    });
  }

  async orderOnHold(
    mailData: MailData<{
      order_id: string;
      from_status: string;
      order_status: string;
      reason?: string;
      brand?: string;
    }>,
  ): Promise<void> {
    const subject = `Order ${mailData.data.order_id} On Hold`;

    await this.mailerService.sendMail({
      to: mailData.to,
      subject,
      templatePath: path.join(
        this.configService.getOrThrow("app.workingDirectory", { infer: true }),
        "src",
        "mail",
        "mail-templates",
        "notifications",
        "hold.hbs",
      ),
      brand: mailData.data.brand,
      context: {
        order_id: mailData.data.order_id,
        from_status: mailData.data.from_status,
        order_status: mailData.data.order_status,
        reason: mailData.data.reason,
      },
    });
  }

  async orderStatusChanged(
    mailData: MailData<{
      order_id: string;
      from_status?: string;
      order_status: string;
      orders_url: string;
      brand?: string;
    }>,
  ): Promise<void> {
    const subject = `Order ${mailData.data.order_id} Status Changed`;

    await this.mailerService.sendMail({
      to: mailData.to,
      subject,
      templatePath: path.join(
        this.configService.getOrThrow("app.workingDirectory", { infer: true }),
        "src",
        "mail",
        "mail-templates",
        "notifications",
        "status-changed.hbs",
      ),
      brand: mailData.data.brand,
      context: {
        order_id: mailData.data.order_id,
        from_status: mailData.data.from_status,
        order_status: mailData.data.order_status,
        orders_url: mailData.data.orders_url,
      },
    });
  }

  async customerConfirmation(
    mailData: MailData<{
      name: string;
      customer_confirmation_landing_page: string;
      fitter_name: string;
      fitter_email: string;
      fitter_phone: string;
      fitter_cell?: string;
      order_id: string;
      brand?: string;
    }>,
  ): Promise<void> {
    const subject = `Order ${mailData.data.order_id} - Customer Confirmation Required`;

    await this.mailerService.sendMail({
      to: mailData.to,
      subject,
      templatePath: path.join(
        this.configService.getOrThrow("app.workingDirectory", { infer: true }),
        "src",
        "mail",
        "mail-templates",
        "notifications",
        "customer-confirmation.hbs",
      ),
      brand: mailData.data.brand,
      context: {
        name: mailData.data.name,
        customer_confirmation_landing_page:
          mailData.data.customer_confirmation_landing_page,
        fitter_name: mailData.data.fitter_name,
        fitter_email: mailData.data.fitter_email,
        fitter_phone: mailData.data.fitter_phone,
        fitter_cell: mailData.data.fitter_cell,
        order_id: mailData.data.order_id,
      },
    });
  }

  async newComment(
    mailData: MailData<{
      user_full_name: string;
      order_id: string;
      comment_text?: string;
      order_url: string;
      brand?: string;
    }>,
  ): Promise<void> {
    const subject = `New Comment on Order ${mailData.data.order_id}`;

    await this.mailerService.sendMail({
      to: mailData.to,
      subject,
      templatePath: path.join(
        this.configService.getOrThrow("app.workingDirectory", { infer: true }),
        "src",
        "mail",
        "mail-templates",
        "notifications",
        "comment.hbs",
      ),
      brand: mailData.data.brand,
      context: {
        user_full_name: mailData.data.user_full_name,
        order_id: mailData.data.order_id,
        comment_text: mailData.data.comment_text,
        order_url: mailData.data.order_url,
      },
    });
  }

  async stockRequest(
    mailData: MailData<{
      username: string;
      product_name: string;
      product_id: string;
      quantity?: number;
      available_stock_url: string;
      no_country_managers?: boolean;
      country?: string;
      brand?: string;
    }>,
  ): Promise<void> {
    const subject = `Stock Request for ${mailData.data.product_name}`;

    await this.mailerService.sendMail({
      to: mailData.to,
      subject,
      templatePath: path.join(
        this.configService.getOrThrow("app.workingDirectory", { infer: true }),
        "src",
        "mail",
        "mail-templates",
        "stock",
        "request-from-stock.hbs",
      ),
      brand: mailData.data.brand,
      context: {
        username: mailData.data.username,
        product_name: mailData.data.product_name,
        product_id: mailData.data.product_id,
        quantity: mailData.data.quantity,
        available_stock_url: mailData.data.available_stock_url,
        no_country_managers: mailData.data.no_country_managers,
        country: mailData.data.country,
      },
    });
  }
}
