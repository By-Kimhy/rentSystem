import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · RentSystem" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto w-full max-w-sm py-16">
      <h1 className="mb-6 text-2xl font-semibold">Sign in</h1>
      <Suspense fallback={<LoginForm />}>
        <LoginFormWithNext searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LoginFormWithNext({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next, expired } = await searchParams;
  return (
    <>
      {expired !== undefined && (
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">Your session has ended. Please sign in again.</p>
      )}
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </>
  );
}
