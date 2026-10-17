// Daily billing run for a scheduler (cron, Vercel Cron, GitHub Actions…):
//   curl -H "Authorization: Bearer $CRON_SECRET" https://your-host/api/cron/billing
// The rent pages also bring billing up to date whenever a landlord opens them,
// so this only matters for keeping statuses current while nobody is looking.
import { syncBilling } from "@/lib/billing";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  await syncBilling();
  return Response.json({ ok: true });
}
