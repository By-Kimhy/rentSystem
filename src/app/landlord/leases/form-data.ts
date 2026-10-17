import "server-only";
import type { LeaseFormOptions } from "@api/contract";
import { apiGet } from "@/lib/api";
import { formatRent } from "@/lib/format";
import type { PropertyRooms, TenantOption } from "@/components/landlord/LeaseForm";

export async function leaseFormOptions(): Promise<{ properties: PropertyRooms[]; tenants: TenantOption[] }> {
  const { properties, tenants } = await apiGet<LeaseFormOptions>("/landlord/leases/options");
  return {
    properties: properties.map((p) => ({
      property: p.name,
      rooms: p.rooms.map((r) => ({ id: r.id, label: r.name, rent: formatRent(r.rentPrice), status: r.status })),
    })),
    tenants: tenants.map((t) => ({ id: t.id, name: t.fullName })),
  };
}
