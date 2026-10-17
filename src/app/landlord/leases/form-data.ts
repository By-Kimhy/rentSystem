import "server-only";
import { prisma } from "@/lib/db";
import { formatRent } from "@/lib/format";
import type { PropertyRooms, TenantOption } from "@/components/landlord/LeaseForm";

export async function leaseFormOptions(landlordId: string): Promise<{ properties: PropertyRooms[]; tenants: TenantOption[] }> {
  const [properties, tenants] = await Promise.all([
    prisma.property.findMany({
      where: { landlordId },
      orderBy: { name: "asc" },
      include: { rooms: { orderBy: { name: "asc" } } },
    }),
    prisma.tenant.findMany({ where: { landlordId }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
  ]);
  return {
    properties: properties
      .filter((p) => p.rooms.length > 0)
      .map((p) => ({
        property: p.name,
        rooms: p.rooms.map((r) => ({ id: r.id, label: r.name, rent: formatRent(r.rentPrice), status: r.status })),
      })),
    tenants: tenants.map((t) => ({ id: t.id, name: t.fullName })),
  };
}
