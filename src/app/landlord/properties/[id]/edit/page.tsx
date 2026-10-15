import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { PhotoGrid } from "@/components/landlord/PhotoGrid";
import { PropertyForm } from "@/components/landlord/PropertyForm";

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const landlord = await requireRole("LANDLORD");
  const property = await prisma.property.findFirst({
    where: { id, landlordId: landlord.id },
    include: { photos: { orderBy: { createdAt: "asc" } } },
  });
  if (!property) notFound();
  const { photos, ...fields } = property;

  return (
    <div className="max-w-2xl space-y-6">
      <Link href={`/landlord/properties/${property.id}`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        ← {property.name}
      </Link>
      <h1 className="text-2xl font-semibold">Edit property</h1>
      <PhotoGrid photos={photos} editable />
      <PropertyForm property={fields} />
    </div>
  );
}
