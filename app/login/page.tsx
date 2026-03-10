import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-base)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-wide uppercase mb-1">
            Talay Workshop
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Fleet service management
          </p>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
