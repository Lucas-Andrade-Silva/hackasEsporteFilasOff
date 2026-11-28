"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CaretLeft, Play, Pause, Lightning } from "@phosphor-icons/react";
import Gate from "@/components/gate";
import MotionFigure from "@/components/motion-figure";
import { Avatar, Coins, initials } from "@/components/ui";
import { ATTEMPTS_PER_DAY, MISSION_BONUS, SPORT_LABEL, findExercise, findGroup } from "@/lib/catalog";
import { attemptsToday, useAuth } from "@/lib/auth";

export default function ExercisePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { activities } = useAuth();
  const exercise = findExercise(id);
  const [playing, setPlaying] = useState(true);
  const [mission, setMission] = useState(false);
  useEffect(() => { setMission(new URLSearchParams(window.location.search).get("missao") === "1"); }, []);

  if (!exercise) {
    return <main className="dark"><div className="dark-shell"><p className="muted">Exercício não encontrado.</p><Link className="link-btn" href="/">Voltar</Link></div></main>;
  }
  const group = findGroup(exercise.group);
  const reward = mission ? Math.round(exercise.coins * MISSION_BONUS) : exercise.coins;
  const used = attemptsToday(activities, exercise.id);
  const best = activities.filter(a => a.exercise_id === exercise.id).reduce((m, a) => Math.max(m, Number(a.score)), 0);

  return (
    <Gate>{profile => (
      <div className="dark">
        <main className="dark-shell">
          <section className="ex-hero">
            <MotionFigure motion={exercise.motion} label={exercise.title} />
            <div className="ex-hero-top">
              <button className="icon-btn" onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))} aria-label="Voltar">
                <CaretLeft size={22} weight="bold" />
              </button>
              <Coins value={profile.coins} dark />
            </div>
            <div className="ex-hero-text">
              <p className="ex-kicker">
                {mission && <><Lightning size={12} weight="fill" /> Missão do dia · </>}
                {SPORT_LABEL[exercise.sport]} · {group?.title}
              </p>
              <h1 className="ex-title">{exercise.title}</h1>
              <p className="ex-meta">{exercise.minutes} min · +{reward} moedas{mission ? " (bônus da missão)" : ""}</p>
            </div>
          </section>

          <p className="ex-summary">{exercise.summary}</p>
          <ol className="ex-steps">{exercise.steps.map(s => <li key={s}>{s}</li>)}</ol>

          <div className="player">
            <MotionFigure motion={exercise.motion} playing={playing} label={`Demonstração: ${exercise.title}`} />
            <span className="player-badge">Demonstração</span>
            <button className="icon-btn player-ctrl" onClick={() => setPlaying(p => !p)} aria-label={playing ? "Pausar demonstração" : "Tocar demonstração"}>
              {playing ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />}
            </button>
          </div>

          <button className="btn btn-lime start" disabled aria-describedby="start-note" aria-label="Iniciar, em breve">
            <Play size={22} weight="fill" /> Iniciar <span className="soon">EM BREVE</span>
          </button>
          <p className="start-note" id="start-note">A gravação pela câmera chega na próxima versão. Mede: {exercise.measures.toLowerCase()}.</p>

          <div className="rules">
            <div className="rule"><b>{exercise.minScore}</b><span>mínimo para valer</span></div>
            <div className="rule"><b>{Math.max(0, ATTEMPTS_PER_DAY - used)}/{ATTEMPTS_PER_DAY}</b><span>tentativas hoje</span></div>
            <div className="rule"><b style={{ color: "var(--lime)" }}>+{reward}</b><span>moedas ao passar</span></div>
          </div>

          <section className="battle" aria-label="Desafio de pontuação">
            <p className="ex-kicker" style={{ marginTop: 0 }}>Desafio</p>
            <h2 className="t-title2" style={{ marginTop: 4 }}>Supere a marca MOVA</h2>
            <div className="battle-row">
              <div>
                <div className="battle-face" aria-hidden>MOVA</div>
                <div className="battle-name">Referência</div>
                <div className="battle-score">{exercise.referenceScore}</div>
              </div>
              <span className="battle-vs">VS</span>
              <div>
                <div className="battle-face you" aria-hidden>
                  {profile.avatar_path
                    ? <Avatar name={profile.display_name} path={profile.avatar_path} version={profile.updated_at} size={76} />
                    : initials(profile.display_name)}
                </div>
                <div className="battle-name">Você</div>
                <div className="battle-score">{best}</div>
              </div>
            </div>
            <p>A referência é uma meta do MOVA para este exercício, não a marca de um atleta real. Abaixo de {exercise.minScore} pontos a tentativa não vale e você pode refazer, até {ATTEMPTS_PER_DAY} vezes por dia.</p>
          </section>
        </main>
      </div>
    )}</Gate>
  );
}
