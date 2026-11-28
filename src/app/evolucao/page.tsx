"use client";
import Link from "next/link";
import { CheckCircle, XCircle, CoinVertical } from "@phosphor-icons/react";
import Gate from "@/components/gate";
import MotionFigure from "@/components/motion-figure";
import { AppShell, Coins } from "@/components/ui";
import { SPORT_LABEL, findExercise } from "@/lib/catalog";
import { practiceDays, useAuth, type Profile } from "@/lib/auth";

function Evolution({ profile }: { profile: Profile }) {
  const { activities } = useAuth();
  const days = practiceDays(activities);
  const passed = activities.filter(a => a.passed).length;

  return (
    <AppShell>
      <header className="topbar">
        <h1 className="t-large">Evolução</h1>
        <Coins value={profile.coins} />
      </header>

      <div className="quick" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 8 }}>
        <div><b>{activities.length}</b><span>atividades</span></div>
        <div><b>{passed}</b><span>aprovadas</span></div>
        <div><b>{days.size}</b><span>dias treinados</span></div>
      </div>

      {!activities.length ? (
        <section className="empty">
          <div className="empty-art"><MotionFigure motion="sprint" label="Atleta correndo" /></div>
          <h2>Sua história começa no primeiro treino</h2>
          <p>Cada exercício que você fizer aparece aqui, com a pontuação, se passou e as moedas que ganhou.</p>
          <Link href="/" className="btn btn-primary">Ver treinos</Link>
        </section>
      ) : (
        <section style={{ marginTop: 16 }}>
          {activities.map(a => {
            const e = findExercise(a.exercise_id);
            const date = new Date(a.created_at);
            return (
              <Link key={a.id} href={`/exercicio/${a.exercise_id}`} className="activity">
                <span className="activity-thumb">{e && <MotionFigure motion={e.motion} playing={false} label={e.title} />}</span>
                <span>
                  <span className="t-headline" style={{ display: "block" }}>{e?.title ?? a.exercise_id}</span>
                  <span className="t-foot muted">
                    {e ? SPORT_LABEL[e.sport] + " · " : ""}
                    {date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} às {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
                <span style={{ textAlign: "right" }}>
                  <span className="t-headline row" style={{ gap: 4, justifyContent: "flex-end" }}>
                    {a.passed ? <CheckCircle size={18} weight="fill" className="lilac" aria-label="Passou" /> : <XCircle size={18} weight="fill" style={{ color: "var(--danger)" }} aria-label="Não passou" />}
                    {Number(a.score)} pts
                  </span>
                  {a.coins_awarded > 0 && <span className="t-foot muted row" style={{ gap: 3, justifyContent: "flex-end" }}><CoinVertical size={13} weight="fill" />+{a.coins_awarded}</span>}
                </span>
              </Link>
            );
          })}
        </section>
      )}
    </AppShell>
  );
}

export default function Page() {
  return <Gate>{profile => <Evolution profile={profile} />}</Gate>;
}
