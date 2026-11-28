"use client";
import type { ReactNode } from "react";
import { useRequireAuth, type Profile } from "@/lib/auth";
import { Splash } from "./ui";

/** Só renderiza a tela com sessão e perfil carregados. */
export default function Gate({ children }: { children: (profile: Profile) => ReactNode }) {
  const auth = useRequireAuth();
  if (auth.loading || !auth.session) return <Splash />;
  if (!auth.profile) {
    return (
      <main className="flow">
        <section className="flow-step">
          <h1 className="t-title1">Não encontramos seu perfil</h1>
          <p className="muted" style={{ margin: "10px 0 20px" }}>Pode ser a conexão. Tente de novo ou saia e entre outra vez.</p>
          <button className="btn btn-primary" onClick={() => auth.refresh()}>Tentar de novo</button>
          <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => auth.signOut()}>Sair</button>
        </section>
      </main>
    );
  }
  return <>{children(auth.profile)}</>;
}
