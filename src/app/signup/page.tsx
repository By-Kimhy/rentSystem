import { Suspense } from "react";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create account · RentSystem" };

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <div className="mx-auto w-full max-w-sm py-16">
      <h1 className="mb-6 text-2xl font-semibold">Create your account</h1>
      <Suspense fallback={<SignupForm />}>
        <SignupFormWithNext searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SignupFormWithNext({ searchParams }: Pick<PageProps<"/signup">, "searchParams">) {
  const { next } = await searchParams;
  return <SignupForm next={typeof next === "string" ? next : undefined} />;
}
