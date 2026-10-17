// The web app's only route to data: every page and Server Action calls the Express API in
// server/, passing the visitor's session cookie along.
import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ApiErrorBody } from "@api/contract";
import { SESSION_COOKIE } from "./jwt";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

// Where to go when the cookie is there but the API no longer accepts it (expired, account
// disabled or deleted). The proxy clears the cookie on this URL, or it would bounce the visitor
// straight back to their dashboard.
export const SESSION_ENDED = "/login?expired=1";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: Record<string, string[] | undefined>,
  ) {
    super(message);
  }
}

// Dates arrive as ISO strings; turn them back into Date objects (see Wire<T> in contract.ts).
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const revive = (_key: string, value: unknown) =>
  typeof value === "string" && ISO_DATETIME.test(value) ? new Date(value) : value;

type Body = Record<string, unknown> | FormData;

async function call<T>(method: string, path: string, body?: Body, token?: string): Promise<T> {
  const session = token ?? (await cookies()).get(SESSION_COOKIE)?.value;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (session) headers.Authorization = `Bearer ${session}`;
  if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text, revive) : undefined;
  if (!res.ok) {
    const err = (data ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(res.status, err.error ?? `API request failed (${res.status})`, err.fieldErrors);
  }
  return data as T;
}

/**
 * For pages: reads data, sending a signed-out visitor to /login and a missing record to the
 * 404 page. Query values that are undefined or empty are left out.
 */
export async function apiGet<T>(path: string, query?: Record<string, string | undefined>): Promise<T> {
  const params = new URLSearchParams(Object.entries(query ?? {}).filter((e): e is [string, string] => Boolean(e[1])));
  const qs = params.size ? `?${params}` : "";
  try {
    return await call<T>("GET", `${path}${qs}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect(SESSION_ENDED);
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

/** For Server Actions: changes data. Failures throw ApiError for the action to show. */
export const api = {
  post: <T = unknown>(path: string, body: Body = {}, token?: string) => call<T>("POST", path, body, token),
  put: <T = unknown>(path: string, body: Body) => call<T>("PUT", path, body),
  delete: (path: string) => call<void>("DELETE", path),
  get: <T>(path: string, token?: string) => call<T>("GET", path, undefined, token),
};

/**
 * Runs an API call from a Server Action and turns validation and rule failures into the
 * { error, fieldErrors } the forms display. Anything else (a 500, a lost session) is rethrown.
 */
export async function attempt<T>(
  fn: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> }> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 400 || e.status === 409)) {
      return { ok: false, error: e.message, fieldErrors: e.fieldErrors };
    }
    if (e instanceof ApiError && e.status === 401) redirect(SESSION_ENDED);
    throw e;
  }
}
