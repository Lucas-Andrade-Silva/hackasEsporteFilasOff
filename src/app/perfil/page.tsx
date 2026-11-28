"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ChartBar, SlidersHorizontal, Fire, LockSimple, Camera, SignOut, SealCheck, CaretLeft, CaretRight,
} from "@phosphor-icons/react";
import Gate from "@/components/gate";
import LeagueBadge from "@/components/league-badge";
import { AppShell, Avatar, Coins, Segmented, SectionTitle } from "@/components/ui";
import {
  BADGES, EXERCISES, GOAL_LABEL, GROUPS, LEAGUE_TIERS, POSITIONS, SKILLS, SPACE_LABEL, SPORT_LABEL,
  WEEKLY_LABEL, YEARS_LABEL, sportsOf, type Sport,
} from "@/lib/catalog";
import { currentStreak, practiceDays, useAuth, type Activity, type Profile } from "@/lib/auth";
import { friendlyError, supabase } from "@/lib/supabase";

function longestStreak(days: Set<string>) {
  const sorted = [...days].sort();
  let best = 0, run = 0, prev: Date | null = null;
  for (const d of sorted) {
    const cur = new Date(d + "T12:00:00");
    run = prev && (cur.getTime() - prev.getTime()) / 86400000 === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = cur;
  }
  return best;
}

function skillScores(sport: Sport, activities: Activity[]) {
  return SKILLS[sport].map(s => {
    const exs = EXERCISES.filter(e => e.sport === sport && e.skill === s.id);
    let best = 0, ref = 100;
    exs.forEach(e => {
      ref = e.referenceScore;
      activities.filter(a => a.exercise_id === e.id).forEach(a => {
        best = Math.max(best, Math.round((Number(a.score) / e.referenceScore) * 100));
      });
    });
    return { ...s, value: Math.min(100, best), ref };
  });
}

function Calendar({ days }: { days: Set<string> }) {
  const [offset, setOffset] = useState(0);
  const base = new Date();
  const month = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const first = (month.getDay() + 6) % 7;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const key = (d: number) => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const todayKey = key(base.getDate());
  const streak = currentStreak(days);
  return (
    <div className="calendar">
      <div className="row-between">
        <span className="streak"><Fire size={22} weight="fill" style={{ color: streak ? "#FF7A1A" : "#C7C7CC" }} /> {streak} {streak === 1 ? "dia" : "dias"} seguidos</span>
        <span className="row" style={{ gap: 0 }}>
          <button className="icon-btn" aria-label="Mês anterior" onClick={() => setOffset(o => o - 1)}><CaretLeft size={18} /></button>
          <button className="icon-btn" aria-label="Próximo mês" disabled={offset >= 0} onClick={() => setOffset(o => Math.min(0, o + 1))}><CaretRight size={18} /></button>
        </span>
      </div>
      <p className="t-foot muted">{(s => s[0].toUpperCase() + s.slice(1))(month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }))}</p>
      <div className="cal-grid">
        {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => <span key={i} className="dow">{d}</span>)}
        {Array.from({ length: first }, (_, i) => <span key={"e" + i} />)}
        {Array.from({ length: count }, (_, i) => {
          const k = key(i + 1);
          const done = days.has(k);
          const today = offset === 0 && k === todayKey;
          return <span key={k} className={`cal-day ${done ? "done" : ""} ${today ? "today" : ""}`} aria-label={`${i + 1}${done ? ", treinou" : ""}`}>{i + 1}</span>;
        })}
      </div>
    </div>
  );
}

function Overview({ profile }: { profile: Profile }) {
  const { activities } = useAuth();
  const sports = sportsOf(profile.sport);
  const [sport, setSport] = useState<Sport>(sports[0]);
  const [leagueTier, setLeagueTier] = useState<number | null>(null);
  const days = practiceDays(activities);
  const streakMax = longestStreak(days);

  useEffect(() => {
    supabase()?.rpc("league_ranking").then(({ data }) => {
      const rows = data as { tier: number }[] | null;
      setLeagueTier(rows?.length ? rows[0].tier : null);
    });
  }, []);

  const sportGroups = GROUPS.filter(g => sports.includes(g.sport));
  const won: Record<string, boolean> = {
    first: activities.some(a => a.passed),
    streak3: streakMax >= 3,
    streak7: streakMax >= 7,
    coins100: profile.coins >= 100,
    mission: false,
    allgroups: sportGroups.length > 0 && sportGroups.every(g =>
      activities.some(a => a.passed && EXERCISES.find(e => e.id === a.exercise_id)?.group === g.id)),
  };

  return (
    <>
      <div className="quick">
        <div><b>{profile.height_cm ?? "—"}</b><span>altura (cm)</span></div>
        <div><b>{profile.weight_kg ?? "—"}</b><span>peso (kg)</span></div>
        <div><b>{days.size}</b><span>dias treinados</span></div>
        <div><b>{profile.coins}</b><span>moedas</span></div>
      </div>

      <SectionTitle>Habilidades</SectionTitle>
      {sports.length > 1 && <div style={{ marginBottom: 14 }}><Segmented label="Esporte" value={sport} onChange={setSport} options={sports.map(s => ({ value: s, label: SPORT_LABEL[s] }))} /></div>}
      <div className="skills">
        {skillScores(sport, activities).map(s => (
          <div key={s.id} className="skill">
            <span>{s.label}</span><b>{s.value}</b>
            <span className="bar" aria-hidden><i style={{ width: `${s.value}%` }} /></span>
          </div>
        ))}
      </div>
      <p className="t-foot muted" style={{ marginTop: 12 }}>De 0 a 100, comparado com a marca de referência de cada exercício. Começa em zero até você fazer o primeiro.</p>

      <SectionTitle>Coleção</SectionTitle>
      <div className="badges">
        <div className={`badge ${leagueTier === null ? "locked" : "league"}`}>
          {leagueTier === null ? <LockSimple size={30} /> : <LeagueBadge tier={leagueTier} size={44} />}
          <span>{leagueTier === null ? "Entre na liga" : `Liga ${LEAGUE_TIERS[leagueTier].name}`}</span>
        </div>
        {BADGES.map(b => (
          <div key={b.id} className={`badge ${won[b.id] ? "won" : "locked"}`} title={b.hint}>
            {won[b.id] ? <SealCheck size={32} weight="fill" /> : <LockSimple size={30} />}
            <span>{won[b.id] ? b.title : b.hint}</span>
          </div>
        ))}
      </div>

      <SectionTitle>Ofensiva</SectionTitle>
      <Calendar days={days} />
    </>
  );
}

async function shrinkImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("imagem"))), "image/webp", .85));
}

function EditData({ profile }: { profile: Profile }) {
  const { refresh, signOut } = useAuth();
  const [form, setForm] = useState({
    display_name: profile.display_name, bio: profile.bio ?? "", sport: profile.sport, position: profile.position ?? "",
    height_cm: profile.height_cm?.toString() ?? "", weight_kg: profile.weight_kg?.toString() ?? "",
    years_playing: profile.years_playing ?? "", weekly_sessions: profile.weekly_sessions ?? "",
    goal: profile.goal ?? "", recording_space: profile.recording_space ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }));
  const flash = (m: string) => { setMessage(m); setTimeout(() => setMessage(""), 2200); };

  const num = (v: string) => (v.trim() ? Number(v) : null);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const sb = supabase();
    if (!sb) return;
    setBusy(true); setError("");
    const { error: err } = await sb.from("profiles").update({
      display_name: form.display_name.trim(), bio: form.bio.trim() || null, sport: form.sport,
      position: form.position || null, height_cm: num(form.height_cm), weight_kg: num(form.weight_kg),
      years_playing: form.years_playing || null, weekly_sessions: form.weekly_sessions || null,
      goal: form.goal || null, recording_space: form.recording_space || null,
    }).eq("id", profile.id);
    setBusy(false);
    if (err) { setError(/check/i.test(err.message) ? "Confira altura (100 a 250 cm) e peso (30 a 250 kg)." : friendlyError(err.message)); return; }
    await refresh();
    flash("Dados salvos");
  };

  const upload = async (file: File | undefined) => {
    const sb = supabase();
    if (!sb || !file) return;
    setError("");
    try {
      const blob = await shrinkImage(file);
      const path = `${profile.id}/avatar.webp`;
      const up = await sb.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/webp" });
      if (up.error) throw up.error;
      const { error: err } = await sb.from("profiles").update({ avatar_path: path }).eq("id", profile.id);
      if (err) throw err;
      await refresh();
      flash("Foto atualizada");
    } catch { setError("Não foi possível enviar a foto. Use JPG, PNG ou WebP."); }
  };

  const positions = sportsOf(form.sport).flatMap(s => POSITIONS[s].map(p => `${SPORT_LABEL[s]} · ${p}`));

  return (
    <form onSubmit={save} style={{ marginTop: 20 }}>
      <button type="button" className="btn btn-lime" onClick={() => fileRef.current?.click()} style={{ marginBottom: 18 }}>
        <Camera size={20} weight="bold" /> {profile.avatar_path ? "Trocar foto" : "Adicionar foto"}
      </button>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => upload(e.target.files?.[0])} />

      <p className="t-caps" style={{ margin: "8px 0 10px" }}>Informações básicas · visível só para você</p>
      <div className="field"><label htmlFor="n">Nome</label><input id="n" className="input" required maxLength={60} value={form.display_name} onChange={set("display_name")} /></div>
      <div className="field"><label htmlFor="b">Bio</label><textarea id="b" className="input" maxLength={280} value={form.bio} onChange={set("bio")} placeholder="Conte um pouco do seu jogo" /></div>
      <div className="row">
        <div className="field" style={{ flex: 1 }}><label htmlFor="h">Altura (cm)</label><input id="h" className="input" inputMode="numeric" value={form.height_cm} onChange={set("height_cm")} /></div>
        <div className="field" style={{ flex: 1 }}><label htmlFor="w">Peso (kg)</label><input id="w" className="input" inputMode="numeric" value={form.weight_kg} onChange={set("weight_kg")} /></div>
      </div>
      <div className="field"><label htmlFor="s">Esporte</label>
        <select id="s" className="input" value={form.sport} onChange={set("sport")}>
          <option value="volleyball">Vôlei</option><option value="basketball">Basquete</option><option value="both">Os dois</option>
        </select></div>
      <div className="field"><label htmlFor="p">Posição</label>
        <select id="p" className="input" value={form.position} onChange={set("position")}>
          <option value="">Ainda não sei</option>
          {positions.map(p => <option key={p} value={p}>{p}</option>)}
        </select></div>
      <div className="field"><label htmlFor="y">Tempo de prática</label>
        <select id="y" className="input" value={form.years_playing} onChange={set("years_playing")}>
          <option value="">—</option>{Object.entries(YEARS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select></div>
      <div className="field"><label htmlFor="ws">Treinos por semana</label>
        <select id="ws" className="input" value={form.weekly_sessions} onChange={set("weekly_sessions")}>
          <option value="">—</option>{Object.entries(WEEKLY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select></div>
      <div className="field"><label htmlFor="g">Objetivo</label>
        <select id="g" className="input" value={form.goal} onChange={set("goal")}>
          <option value="">—</option>{Object.entries(GOAL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select></div>
      <div className="field"><label htmlFor="sp">Onde grava</label>
        <select id="sp" className="input" value={form.recording_space} onChange={set("recording_space")}>
          <option value="">—</option>{Object.entries(SPACE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select></div>

      {error && <p className="error-text" role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={busy} style={{ marginTop: 8 }}>{busy ? "Salvando..." : "Salvar"}</button>

      <p className="t-foot muted" style={{ marginTop: 20 }}>
        Sua conta é isolada: só você vê seus dados e atividades. No ranking aparecem seu nome, sua foto e suas moedas, apenas para quem está na mesma liga ou no mesmo grupo.
      </p>
      <button type="button" className="danger-link" onClick={() => signOut()}><SignOut size={18} /> Sair da conta</button>
      {message && <div className="toast" role="status">{message}</div>}
    </form>
  );
}

function ProfileScreen({ profile }: { profile: Profile }) {
  const [tab, setTab] = useState<"overview" | "edit">("overview");
  const position = profile.position?.split(" · ").pop();
  return (
    <AppShell>
      <header className="topbar">
        <span className="wordmark">MOVA</span>
        <Coins value={profile.coins} />
      </header>
      <section className="profile-top">
        <Avatar name={profile.display_name} path={profile.avatar_path} version={profile.updated_at} size={104} />
        <h1 className="profile-name">{profile.display_name || "Atleta"}</h1>
        <p className="profile-sub">
          {sportsOf(profile.sport).map(s => SPORT_LABEL[s]).join(" e ")}{position ? ` · ${position}` : ""}
        </p>
        {profile.bio && <p className="t-sub" style={{ marginTop: 8, color: "var(--ink-2)" }}>{profile.bio}</p>}
      </section>
      <div className="subtabs" role="tablist" aria-label="Seções do perfil">
        <button role="tab" aria-selected={tab === "overview"} aria-label="Visão geral" onClick={() => setTab("overview")}><ChartBar size={26} weight={tab === "overview" ? "fill" : "regular"} /></button>
        <button role="tab" aria-selected={tab === "edit"} aria-label="Editar dados" onClick={() => setTab("edit")}><SlidersHorizontal size={26} weight={tab === "edit" ? "fill" : "regular"} /></button>
      </div>
      {tab === "overview" ? <Overview profile={profile} /> : <EditData profile={profile} />}
    </AppShell>
  );
}

export default function Page() {
  return <Gate>{profile => <ProfileScreen profile={profile} />}</Gate>;
}
