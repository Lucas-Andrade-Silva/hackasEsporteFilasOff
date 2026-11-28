"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CaretLeft } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth";
import { friendlyError, supabase } from "@/lib/supabase";
import { SetupNotice } from "@/components/ui";

export default function SignIn() {
  const router = useRouter();
  const { session, configured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (session) router.replace("/"); }, [session, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const sb = supabase();
    if (!sb) return;
    setBusy(true); setError("");
    const { error: err } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(friendlyError(err.message));
    else router.replace("/");
  };

  return (
    <main className="flow">
      <div className="flow-head">
        <Link className="icon-btn" href="/bem-vindo" aria-label="Voltar"><CaretLeft size={24} weight="bold" /></Link>
      </div>
      <form className="flow-step" onSubmit={submit}>
        <p className="t-caps">De volta</p>
        <h1 className="t-large">Entrar no Atleta10</h1>
        {!configured && <div style={{ marginBottom: 16 }}><SetupNotice /></div>}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" required autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input id="password" className="input" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {error && <p className="error-text" role="alert">{error}</p>}
        <div className="flow-foot" style={{ marginTop: 18 }}>
          <button className="btn btn-primary" disabled={busy || !configured}>{busy ? "Entrando..." : "Entrar"}</button>
          <p className="t-foot muted" style={{ textAlign: "center", marginTop: 12 }}>Ainda não tem conta? <Link className="lilac" href="/onboarding">Começar</Link></p>
        </div>
      </form>
    </main>
  );
}
