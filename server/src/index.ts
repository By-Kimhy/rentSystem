import { createApp } from "./app.js";
import { config } from "./config.js";
import { mailProvider } from "./lib/mail.js";
import { startReminderScheduler } from "./scheduler.js";

config.sessionSecret(); // fail fast if the secret is missing

createApp().listen(config.port, () => {
  console.log(`RentSystem API listening on http://localhost:${config.port}`);
  const mail = mailProvider();
  if (!["console", "smtp", "resend", "none", "memory"].includes(mail)) {
    console.warn(`Unknown MAIL_PROVIDER "${mail}"; emails will be printed to this log instead.`);
  } else if (mail === "console") {
    console.log("Emails are printed to this log. Set MAIL_PROVIDER=smtp or resend to send them for real.");
  }
  startReminderScheduler();
});
