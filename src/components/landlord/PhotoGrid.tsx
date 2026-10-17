import type { Photo } from "@prisma/client";
import { deletePhoto } from "@/app/landlord/properties/actions";
import { photoUrl } from "@/lib/photos";
import { ConfirmButton } from "./ConfirmButton";

export function PhotoGrid({ photos, editable = false }: { photos: Photo[]; editable?: boolean }) {
  if (photos.length === 0) return <p className="text-sm text-zinc-500">No photos yet.</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {photos.map((photo) => (
        <li key={photo.id} className="space-y-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl(photo.fileName)} alt="" className="aspect-[4/3] w-full rounded-md object-cover" />
          {editable && (
            <ConfirmButton action={deletePhoto.bind(null, photo.id)} message="Remove this photo?">
              Remove
            </ConfirmButton>
          )}
        </li>
      ))}
    </ul>
  );
}
