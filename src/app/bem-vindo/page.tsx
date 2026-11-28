"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react";
import { YouTubeClip } from "@/components/youtube-clip";
import { clipFor } from "@/lib/clips";
import { useAuth } from "@/lib/auth";
import { Wordmark } from "@/components/ui";

export default function Welcome() {
  const { session, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && session) router.replace("/"); }, [loading, session, router]);

  return (
    <main className="welcome">
      <div className="welcome-art">
        <YouTubeClip clip={clipFor("v-ataque")} label="Atleta atacando no vôlei" />
        <span className="welcome-logo"><Wordmark light height={32} /></span>
      </div>
      <div className="welcome-body">
        <h1 className="welcome-title">Salta.<span>Evolui.</span><em>Aparece.</em></h1>
        <p className="t-callout">Treinos de vôlei e basquete medidos pela câmera do celular. Ganhe moedas, suba de divisão e desafie seus amigos.</p>
        <Link href="/onboarding" className="btn btn-lime">Começar <ArrowRight size={20} weight="bold" /></Link>
        <Link href="/entrar" className="btn btn-ghost" style={{ marginTop: 6 }}>Já tenho conta</Link>
      </div>
    </main>
  );
}
