export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  errors,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  errors?: string[];
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-300"
      />
      {errors?.map((e) => (
        <span key={e} className="text-red-600">
          {e}
        </span>
      ))}
    </label>
  );
}

export const buttonClass =
  "rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";
