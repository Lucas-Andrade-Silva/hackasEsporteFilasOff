"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CaretLeft, EnvelopeSimple } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth";
import { friendlyError, supabase } from "@/lib/supabase";
import { clearAnswers, isComplete, loadAnswers } from "@/lib/onboarding";
import { SetupNotice } from "@/components/ui";
import type { Answers } from "@/lib/catalog";

export default function SignUp() {
  const router = useRouter();
  const { session, configured } = useAuth();
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");

  useEffect(() => {
    const a = loadAnswers();
    if (!isComplete(a)) { router.replace("/onboarding"); return; }
    setAnswers(a);
  }, [router]);
  useEffect(() => { if (session) router.replace("/"); }, [session, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const sb = supabase();
    if (!sb || !answers) return;
    setBusy(true); setError("");
    const { data, error: err } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { ...answers, adult_confirmed: answers.adult_confirmed ? "true" : "false", display_name: name.trim() },
      },
    });
    setBusy(false);
    if (err) { setError(friendlyError(err.message)); return; }
    clearAnswers();
    if (data.session) router.replace("/");
    else setSentTo(email.trim());
  };

  if (!answers) return null;

  if (sentTo) {
    return (
      <main className="flow">
        <section className="flow-step" style={{ textAlign: "center", paddingTop: 60 }}>
          <EnvelopeSimple size={56} className="lilac" style={{ margin: "0 auto" }} />
          <h1 className="t-large" style={{ marginTop: 18 }}>Confira seu email</h1>
          <p className="t-callout muted">Enviamos um link de confirmação para <b>{sentTo}</b>. Abra o link neste aparelho para entrar.</p>
        </section>
        <Link className="btn btn-ghost" href="/entrar">Já confirmei, quero entrar</Link>
      </main>
    );
  }

  return (
    <main className="flow">
      <div className="flow-head">
        <Link className="icon-btn" href="/onboarding" aria-label="Voltar"><CaretLeft size={24} weight="bold" /></Link>
      </div>
      <form className="flow-step" onSubmit={submit}>
        <p className="t-caps">Sua conta</p>
        <h1 className="t-large">Crie seu perfil de atleta</h1>
        {!configured && <div style={{ marginBottom: 16 }}><SetupNotice /></div>}
        <div className="field">
          <label htmlFor="name">Nome</label>
          <input id="name" className="input" required maxLength={60} autoComplete="name" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" required autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input id="password" className="input" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <p className="t-foot muted">Seu desempenho é só seu: cada conta é isolada no banco. No ranking aparecem apenas seu nome, sua foto e suas moedas.</p>
        {error && <p className="error-text" role="alert">{error}</p>}
        <div className="flow-foot" style={{ marginTop: 18 }}>
          <button className="btn btn-primary" disabled={busy || !configured}>{busy ? "Criando..." : "Criar conta"}</button>
          <p className="t-foot muted" style={{ textAlign: "center", marginTop: 12 }}>Já tem conta? <Link className="lilac" href="/entrar">Entrar</Link></p>
        </div>
      </form>
    </main>
  );
}
