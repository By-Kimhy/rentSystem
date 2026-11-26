// Outgoing email. MAIL_PROVIDER picks how mail leaves the API:
//   console  (default) prints each email to the API's log, for local development
//   smtp     any SMTP server (Gmail, Mailgun, SES, Postmark…) via SMTP_URL or SMTP_HOST/PORT/USER/PASS
//   resend   the Resend HTTP API, with RESEND_API_KEY
//   memory   keeps emails in `outbox` for tests
//   none     drops every email
// MAIL_FROM sets the sender, e.g. "RentSystem <no-reply@example.com>".
import nodemailer, { type Transporter } from "nodemailer";

export type Email = { to: string; subject: string; text: string };

/** Emails sent while MAIL_PROVIDER=memory. Tests read and clear it. */
export const outbox: Email[] = [];

const from = () => process.env.MAIL_FROM || "RentSystem <no-reply@rentsystem.local>";

export function mailProvider() {
  return (process.env.MAIL_PROVIDER || "console").trim().toLowerCase();
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// A plain HTML version of the text: paragraphs, with web links made clickable.
export function toHtml(text: string) {
  const paragraphs = text.split(/\n{2,}/).map((p) =>
    escapeHtml(p)
      .replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}">${url}</a>`)
      .replace(/\n/g, "<br>"),
  );
  return `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#18181b">${paragraphs
    .map((p) => `<p>${p}</p>`)
    .join("")}</div>`;
}

let smtp: Transporter | null = null;
function smtpTransport() {
  if (smtp) return smtp;
  const url = process.env.SMTP_URL;
  if (url) {
    smtp = nodemailer.createTransport(url);
  } else {
    if (!process.env.SMTP_HOST) throw new Error("MAIL_PROVIDER=smtp needs SMTP_URL or SMTP_HOST");
    const port = Number(process.env.SMTP_PORT || 587);
    smtp = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
    });
  }
  return smtp;
}

async function sendWithResend(email: Email) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("MAIL_PROVIDER=resend needs RESEND_API_KEY");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: from(), to: [email.to], subject: email.subject, text: email.text, html: toHtml(email.text) }),
  });
  if (!res.ok) throw new Error(`Resend refused the email (${res.status}): ${await res.text()}`);
}

/** Sends one email. Throws if the provider refuses it. */
export async function sendEmail(email: Email): Promise<void> {
  switch (mailProvider()) {
    case "memory":
      outbox.push(email);
      return;
    case "none":
      return;
    case "smtp":
      await smtpTransport().sendMail({ from: from(), to: email.to, subject: email.subject, text: email.text, html: toHtml(email.text) });
      return;
    case "resend":
      await sendWithResend(email);
      return;
    default:
      console.log(`\n--- email to ${email.to} ---\nSubject: ${email.subject}\n\n${email.text}\n--- end of email ---\n`);
  }
}
