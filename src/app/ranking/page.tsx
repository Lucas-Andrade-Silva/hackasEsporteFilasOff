"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  GlobeHemisphereWest, UsersThree, CoinVertical, ShareNetwork, SignOut, Plus, ArrowRight, Medal,
} from "@phosphor-icons/react";
import Gate from "@/components/gate";
import { AppShell, Avatar, Coins, Segmented } from "@/components/ui";
import LeagueBadge from "@/components/league-badge";
import { LEAGUE_TIERS } from "@/lib/catalog";
import { friendlyError, supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/auth";

type Row = { rank: number; display_name: string; avatar_path: string | null; coins: number; is_me: boolean; tier?: number };
type Group = { id: string; name: string; code: string; member_count: number; is_owner: boolean };

function RankList({ rows }: { rows: Row[] }) {
  return (
    <div className="rank-list">
      {rows.map(r => (
        <div key={r.rank} className={`rank-row ${r.is_me ? "me" : ""}`}>
          <span className="rank-pos">{r.rank}</span>
          <Avatar name={r.display_name || "Atleta"} path={r.avatar_path} size={40} />
          <span className="rank-name">{r.display_name || "Atleta"}{r.is_me && <span className="muted"> · você</span>}</span>
          <span className="rank-coins"><CoinVertical size={16} weight="fill" className="lilac" />{r.coins.toLocaleString("pt-BR")}</span>
        </div>
      ))}
    </div>
  );
}

function League({ profile }: { profile: Profile }) {
  const sb = supabase();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (rebalance: boolean) => {
    if (!sb) { setRows([]); return; }
    let { data, error: err } = await sb.rpc("league_ranking");
    if (!err && rebalance && data?.length) {
      await sb.rpc("join_league");
      ({ data, error: err } = await sb.rpc("league_ranking"));
    }
    if (err) setError(friendlyError(err.message));
    setRows((data as Row[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(true); }, [load]);

  const join = async () => {
    if (!sb) return;
    setBusy(true); setError("");
    const { error: err } = await sb.rpc("join_league");
    setBusy(false);
    if (err) setError(friendlyError(err.message)); else void load(false);
  };
  const leave = async () => {
    if (!sb) return;
    await sb.rpc("leave_league");
    void load(false);
  };

  if (rows === null) return <p className="muted" style={{ marginTop: 24 }}>Carregando...</p>;

  if (!rows.length) {
    return (
      <section className="join-card">
        <span className="big-num" aria-hidden>20</span>
        <span className="mission-tag"><GlobeHemisphereWest size={14} weight="fill" /> Liga Atleta10</span>
        <h2>Dispute com quem está no seu nível</h2>
        <p>Você entra num grupo de até 20 pessoas com pontuação parecida com a sua. Cada exercício que você passa vale moedas, e as moedas sobem você no ranking e de divisão.</p>
        <button className="btn btn-lime" onClick={join} disabled={busy}>{busy ? "Entrando..." : "Entrar na liga"} <ArrowRight size={20} weight="bold" /></button>
        {error && <p className="error-text">{error}</p>}
      </section>
    );
  }

  const tier = rows[0]?.tier ?? 0;
  const next = LEAGUE_TIERS[tier + 1];
  return (
    <>
      <div className="league-head">
        <span className="league-badge"><LeagueBadge tier={tier} /></span>
        <div>
          <p className="t-caps">Divisão</p>
          <h2 className="t-title1">{LEAGUE_TIERS[tier].name}</h2>
          <p className="t-foot muted">{rows.length} de 20 pessoas · ordem por moedas</p>
        </div>
      </div>
      {next && <p className="notice" style={{ marginTop: 12 }}>Chegue a <b>{next.min} moedas</b> para subir para a divisão {next.name}. Você tem {profile.coins}.</p>}
      <RankList rows={rows} />
      <button className="danger-link" style={{ marginTop: 8 }} onClick={leave}><SignOut size={18} /> Sair da liga</button>
    </>
  );
}

function Friends() {
  const sb = supabase();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const loadGroups = useCallback(async (select?: string) => {
    if (!sb) { setGroups([]); return; }
    const { data } = await sb.rpc("my_friend_groups");
    const list = (data as Group[]) ?? [];
    setGroups(list);
    setActive(a => select ?? (a && list.some(g => g.id === a) ? a : list[0]?.id ?? null));
  }, [sb]);
  useEffect(() => { void loadGroups(); }, [loadGroups]);
  useEffect(() => {
    if (!sb || !active) { setRows([]); return; }
    sb.rpc("friend_group_ranking", { p_group: active }).then(({ data }) => setRows((data as Row[]) ?? []));
  }, [sb, active]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!sb || !name.trim()) return;
    setError("");
    const { data, error: err } = await sb.rpc("create_friend_group", { p_name: name.trim() });
    if (err) { setError(friendlyError(err.message)); return; }
    setName("");
    const created = (data as { id: string; code: string }[])[0];
    await loadGroups(created?.id);
    flash(`Grupo criado. Código ${created?.code}`);
  };
  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (!sb || !code.trim()) return;
    setError("");
    const { data, error: err } = await sb.rpc("join_friend_group", { p_code: code.trim() });
    if (err) { setError(friendlyError(err.message)); return; }
    setCode("");
    await loadGroups(data as string);
    flash("Você entrou no grupo");
  };
  const share = async (g: Group) => {
    const text = `Entra no meu grupo "${g.name}" no Atleta10 com o código ${g.code}`;
    if (navigator.share) { try { await navigator.share({ title: "Atleta10", text, url: window.location.origin }); } catch { /* cancelado */ } }
    else { await navigator.clipboard.writeText(`${text} ${window.location.origin}`); flash("Convite copiado"); }
  };
  const leave = async (g: Group) => {
    if (!sb) return;
    await sb.rpc("leave_friend_group", { p_group: g.id });
    await loadGroups();
  };

  if (groups === null) return <p className="muted" style={{ marginTop: 24 }}>Carregando...</p>;
  const current = groups.find(g => g.id === active);

  return (
    <>
      {groups.length > 0 && (
        <div className="stack" style={{ marginTop: 20 }}>
          {groups.map(g => (
            <button key={g.id} className={`friend-group ${g.id === active ? "on" : ""}`} onClick={() => setActive(g.id)}>
              <UsersThree size={26} weight="fill" />
              <span style={{ flex: 1 }}>
                <span className="t-headline" style={{ display: "block" }}>{g.name}</span>
                <span className="t-foot muted">{g.member_count} {g.member_count === 1 ? "pessoa" : "pessoas"}</span>
              </span>
              <span className="code" style={{ fontSize: 15 }}>{g.code}</span>
            </button>
          ))}
        </div>
      )}

      {current && (
        <>
          <RankList rows={rows} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btn-lilac" onClick={() => share(current)}><ShareNetwork size={20} weight="bold" /> Convidar</button>
            <button className="btn btn-ghost" style={{ width: "auto" }} onClick={() => leave(current)} aria-label="Sair do grupo"><SignOut size={20} /></button>
          </div>
        </>
      )}

      {!groups.length && (
        <section className="join-card">
          <span className="mission-tag"><UsersThree size={14} weight="fill" /> Só entre amigos</span>
          <h2>Seu time, seu ranking</h2>
          <p>Crie um grupo e mande o código para quem você quiser. Só quem tem o código entra, e vocês disputam só entre vocês.</p>
        </section>
      )}

      <form className="card" style={{ marginTop: 20 }} onSubmit={create}>
        <h3 className="t-headline">Criar grupo</h3>
        <div className="row" style={{ marginTop: 10 }}>
          <input className="input" placeholder="Nome do grupo" maxLength={40} value={name} onChange={e => setName(e.target.value)} aria-label="Nome do grupo" />
          <button className="btn btn-primary" style={{ width: 56, padding: 0 }} aria-label="Criar grupo"><Plus size={22} weight="bold" /></button>
        </div>
      </form>
      <form className="card" style={{ marginTop: 10 }} onSubmit={join}>
        <h3 className="t-headline">Entrar com código</h3>
        <div className="row" style={{ marginTop: 10 }}>
          <input className="input code" style={{ fontSize: 18 }} placeholder="ABC123" maxLength={6} value={code}
            onChange={e => setCode(e.target.value.toUpperCase())} aria-label="Código do grupo" autoCapitalize="characters" />
          <button className="btn btn-primary" style={{ width: 56, padding: 0 }} aria-label="Entrar no grupo"><ArrowRight size={22} weight="bold" /></button>
        </div>
      </form>
      {error && <p className="error-text" role="alert">{error}</p>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

function RankingScreen({ profile }: { profile: Profile }) {
  const [tab, setTab] = useState<"league" | "friends">("league");
  return (
    <AppShell>
      <header className="topbar">
        <h1 className="t-large">Ranking</h1>
        <Coins value={profile.coins} />
      </header>
      <Segmented label="Tipo de ranking" value={tab} onChange={setTab} options={[
        { value: "league", label: <><Medal size={18} weight="fill" /> Liga</>, aria: "Liga" },
        { value: "friends", label: <><UsersThree size={18} weight="fill" /> Amigos</>, aria: "Amigos" },
      ]} />
      {tab === "league" ? <League profile={profile} /> : <Friends />}
    </AppShell>
  );
}

export default function Page() {
  return <Gate>{profile => <RankingScreen profile={profile} />}</Gate>;
}
