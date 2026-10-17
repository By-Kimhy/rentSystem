// Outgoing email. With SMTP_URL set, mail goes through that server: Mailpit locally, or any
// provider in production (Resend, SES, Gmail…). Without it, each message is only logged.
// Sending never fails the request that caused it: callers don't await it, and errors are logged.
import nodemailer, { type Transporter } from "nodemailer";
import { config } from "../config.js";

export type Mail = { to: string; subject: string; text: string };

// Under NODE_ENV=test nothing is sent; messages collect here for the tests to check.
export const sentMail: Mail[] = [];

let transport: Transporter | null | undefined;

function smtp() {
  if (transport === undefined) {
    const url = config.smtpUrl();
    transport = url ? nodemailer.createTransport(url) : null;
  }
  return transport;
}

export async function sendMail(mail: Mail): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    sentMail.push(mail);
    return;
  }
  const t = smtp();
  if (!t) {
    console.log(`[mail] SMTP_URL not set, not sent: "${mail.subject}" to ${mail.to}`);
    return;
  }
  try {
    await t.sendMail({ from: config.mailFrom(), ...mail });
  } catch (e) {
    console.error(`[mail] failed to send "${mail.subject}" to ${mail.to}:`, e);
  }
}

// Fire and forget, for use right after the change an email reports has been saved.
export function notify(...mails: (Mail | null | undefined)[]) {
  for (const mail of mails) if (mail) void sendMail(mail);
}
