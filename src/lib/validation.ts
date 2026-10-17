export type FormState = {
  fieldErrors?: Record<string, string[] | undefined>;
  // Echoed back on error so the form, which React resets after submit, keeps what was typed.
  values?: Record<string, string>;
};

export function fieldsFrom(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}
