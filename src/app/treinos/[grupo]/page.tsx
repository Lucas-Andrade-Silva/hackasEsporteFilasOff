"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CaretLeft, CoinVertical, Timer, House, CourtBasketball } from "@phosphor-icons/react";
import Gate from "@/components/gate";
import { ClipFrame } from "@/components/exercise-media";
import { clipFor } from "@/lib/clips";
import { Coins, TabBar } from "@/components/ui";
import { EXERCISES, SPORT_LABEL, findGroup } from "@/lib/catalog";

export default function GroupPage() {
  const { grupo } = useParams<{ grupo: string }>();
  const group = findGroup(grupo);
  return (
    <Gate>{profile => (
      <div className="dark">
        <main className="dark-shell">
          <header className="topbar">
            <Link href="/" className="icon-btn" aria-label="Voltar aos treinos"><CaretLeft size={22} weight="bold" /></Link>
            <Coins value={profile.coins} dark />
          </header>
          {!group ? <p className="muted">Grupo não encontrado.</p> : (
            <>
              <section className="group-hero">
                <p className="ex-kicker">{SPORT_LABEL[group.sport]}</p>
                <h1 className="t-large">{group.title}</h1>
                <p className="muted" style={{ marginTop: 6 }}>{group.tagline}</p>
              </section>
              <div className="ex-list">
                {EXERCISES.filter(e => e.group === group.id).map(e => (
                  <Link key={e.id} href={`/exercicio/${e.id}`} className="ex-card">
                    <div className="ex-thumb"><ClipFrame clip={clipFor(e.id)} /></div>
                    <div>
                      <h3>{e.title}</h3>
                      <p>{e.summary}</p>
                      <div className="ex-tags">
                        <span><Timer size={13} /> {e.minutes} min</span>
                        <span className="tag-coins"><CoinVertical size={13} weight="fill" /> +{e.coins}</span>
                        <span aria-label={e.space === "small" ? "Cabe em casa" : "Precisa de espaço amplo"}>
                          {e.space === "small" ? <House size={13} /> : <CourtBasketball size={13} />}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </main>
        <TabBar />
      </div>
    )}</Gate>
  );
}
