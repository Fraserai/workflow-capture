import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (await isAuthenticated()) {
    redirect("/app/captures");
  }

  const params = await searchParams;
  const error = params.error;
  const next = params.next || "/app/captures";

  return (
    <div className="login-shell">
      <div className="login-orb login-orb-left" />
      <div className="login-orb login-orb-right" />

      <section className="login-panel">
        <div className="eyebrow">Workflow Capture AI</div>
        <h1>Sign in</h1>
        <p className="login-copy">Business console for captures, datasets, and recorder settings.</p>

        <form className="login-form" action="/api/auth/login" method="POST">
          <input type="hidden" name="next" value={next} />
          <label className="field-stack">
            <span>Work email</span>
            <input className="glass-input" type="email" name="email" placeholder="ops@company.internal" required />
          </label>
          <label className="field-stack">
            <span>Password</span>
            <input className="glass-input" type="password" name="password" placeholder="Enter password" required />
          </label>

          {error ? <div className="inline-error">Enter your credentials to continue.</div> : null}

          <button className="primary-action" type="submit">
            Sign in
          </button>
        </form>

        <div className="login-meta">
          <span>Internal</span>
          <span>Managed</span>
          <span>Admin</span>
        </div>
      </section>
    </div>
  );
}
