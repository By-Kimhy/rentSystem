import { SignupForm } from "./signup-form";

export const metadata = { title: "Create account · RentSystem" };

export default function SignupPage() {
  return (
    <div className="mx-auto w-full max-w-sm py-16">
      <h1 className="mb-6 text-2xl font-semibold">Create your account</h1>
      <SignupForm />
    </div>
  );
}
