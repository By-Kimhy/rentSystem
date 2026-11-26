// Runs the email reminders from inside the API, so they go out without setting up cron.
// Every hour, once it is past REMINDER_HOUR (default 9, in BILLING_TIMEZONE), it sends whatever
// is due; reminders already sent are skipped, so the hourly runs don't repeat them.
// Set REMINDER_SCHEDULER=off to turn it off, e.g. when calling POST /api/cron/reminders yourself.
import { sendReminders } from "./lib/reminders.js";

const HOUR_MS = 3_600_000;

function localHour() {
  const timeZone = process.env.BILLING_TIMEZONE || "UTC";
  return Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(new Date()));
}

export function startReminderScheduler() {
  if ((process.env.REMINDER_SCHEDULER ?? "").toLowerCase() === "off") return;
  const fromHour = Number(process.env.REMINDER_HOUR ?? 9);
  let running = false;

  const tick = async () => {
    if (running || localHour() < fromHour) return;
    running = true;
    try {
      const run = await sendReminders();
      if (run.sent || run.failed) console.log(`Reminders: ${run.sent} sent, ${run.failed} failed`);
    } catch (e) {
      console.error("Reminder run failed:", e);
    } finally {
      running = false;
    }
  };

  setTimeout(tick, 60_000).unref();
  setInterval(tick, HOUR_MS).unref();
}
