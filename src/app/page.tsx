"use client";
import Link from "next/link";
import { useState } from "react";
import { Lightning, CoinVertical, Timer } from "@phosphor-icons/react";
import Gate from "@/components/gate";
import { ClipFrame } from "@/components/exercise-media";
import { YouTubeClip } from "@/components/youtube-clip";
import { clipFor, groupClip } from "@/lib/clips";
import { AppShell, Avatar, Coins, Segmented, SectionTitle, Wordmark } from "@/components/ui";
import {
  EXERCISES, MISSION_BONUS, SPORT_LABEL, dailyMission, groupsFor, sportsOf, type Sport,
} from "@/lib/catalog";
import type { Profile } from "@/lib/auth";

function Home({ profile }: { profile: Profile }) {
  const sports = sportsOf(profile.sport);
  const [sport, setSport] = useState<Sport>(sports[0]);
  const mission = dailyMission(profile.id, profile.sport, profile.recording_space ?? undefined, profile.goal ?? undefined);
  const firstName = profile.display_name.split(" ")[0] || "atleta";
  const groups = groupsFor(sport, profile.goal ?? undefined);

  return (
    <AppShell>
      <header className="topbar">
        <Wordmark />
        <div className="row">
          <Coins value={profile.coins} />
          <Link href="/perfil" aria-label="Abrir perfil">
            <Avatar name={profile.display_name} path={profile.avatar_path} version={profile.updated_at} size={36} />
          </Link>
        </div>
      </header>

      <section className="home-hello">
        <p className="t-caps">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="t-large">Bora treinar,<br /><span>{firstName}.</span></h1>
      </section>

      <Link href={`/exercicio/${mission.id}?missao=1`} className="mission" aria-label={`Missão do dia: ${mission.title}`}>
        <YouTubeClip clip={clipFor(mission.id)} label={mission.title} />
        <span className="mission-num" aria-hidden>{new Date().getDate().toString().padStart(2, "0")}</span>
        <div className="mission-body">
          <span className="mission-tag"><Lightning size={14} weight="fill" /> Missão do dia</span>
          <h2 className="mission-title">{mission.title}</h2>
          <p className="t-foot" style={{ color: "#C7C7CC" }}>{SPORT_LABEL[mission.sport]} · {mission.measures}</p>
          <div className="mission-meta">
            <span className="row" style={{ gap: 4 }}><Timer size={16} /> {mission.minutes} min</span>
            <b className="row" style={{ gap: 4 }}><CoinVertical size={16} weight="fill" /> +{Math.round(mission.coins * MISSION_BONUS)}</b>
          </div>
        </div>
      </Link>

      <SectionTitle>Treinos</SectionTitle>
      {sports.length > 1 && (
        <div style={{ marginBottom: 14 }}>
          <Segmented label="Esporte" value={sport} onChange={setSport}
            options={sports.map(s => ({ value: s, label: SPORT_LABEL[s] }))} />
        </div>
      )}
      <div className="groups">
        {groups.map(g => {
          const count = EXERCISES.filter(e => e.group === g.id).length;
          return (
            <Link key={g.id} href={`/treinos/${g.id}`} className="group-card">
              <ClipFrame clip={groupClip(g.id)} />
              <span className="group-count">{count} treinos</span>
              <h3>{g.title}</h3>
              <p>{g.tagline}</p>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}

export default function Page() {
  return <Gate>{profile => <Home profile={profile} />}</Gate>;
}
