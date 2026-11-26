import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Forgot password · RentSystem" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-sm py-16">
      <h1 className="mb-2 text-2xl font-semibold">Forgot your password?</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Enter the email you sign in with and we&apos;ll send you a link to choose a new password.
      </p>
      <ForgotPasswordForm />
    </div>
  );
}
