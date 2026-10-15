export const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-300";

export function Field({
  label,
  name,
  errors,
  children,
}: {
  label: string;
  name: string;
  errors?: Record<string, string[] | undefined>;
  children: React.ReactNode;
}) {
  const message = errors?.[name]?.[0];
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
      {message && <span className="mt-1 block text-sm font-normal text-red-600">{message}</span>}
    </label>
  );
}

export function PhotoInput({ errors }: { errors?: Record<string, string[] | undefined> }) {
  return (
    <Field label="Add photos (JPEG, PNG or WebP, up to 5 MB each)" name="photos" errors={errors}>
      <input
        type="file"
        name="photos"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="mt-1 block w-full text-sm"
      />
    </Field>
  );
}
