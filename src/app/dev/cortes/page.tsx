"use client";
// Página temporária de revisão dos cortes do YouTube. Remover antes do merge.
// ?scan=<id>&from=<s>&to=<s> mostra 9 pontos do vídeo ao mesmo tempo.
import { useEffect, useState } from "react";
import { EXERCISES } from "@/lib/catalog";
import { CLIPS, watchUrl, type Clip } from "@/lib/clips";
import { YouTubeClip } from "@/components/youtube-clip";

function Scan({ id, from, to }: { id: string; from: number; to: number }) {
  const step = (to - from) / 9;
  const points = Array.from({ length: 9 }, (_, i) => Math.round(from + i * step));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
      {points.map(s => {
        const clip: Clip = { id, start: s, end: s + 4, channel: "", title: "" };
        return (
          <div key={s}>
            <div style={{ position: "relative", aspectRatio: "16/9" }}><YouTubeClip clip={clip} label={`${s}s`} /></div>
            <p style={{ fontSize: 12, fontWeight: 700 }}>{s}s</p>
          </div>
        );
      })}
    </div>
  );
}

export default function Cortes() {
  const [page, setPage] = useState(0);
  const [scan, setScan] = useState<{ id: string; from: number; to: number } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get("scan");
    if (id) setScan({ id, from: Number(q.get("from") ?? 0), to: Number(q.get("to") ?? 90) });
  }, []);
  if (scan) return <main style={{ padding: 8, background: "#0b0b0f", color: "#fff", minHeight: "100dvh" }}><Scan {...scan} /></main>;

  const per = 4;
  const list = EXERCISES.slice(page * per, page * per + per);
  return (
    <main style={{ padding: 12, background: "#0b0b0f", color: "#fff", minHeight: "100dvh" }}>
      <div className="row" style={{ marginBottom: 8 }}>
        {Array.from({ length: Math.ceil(EXERCISES.length / per) }, (_, i) => (
          <button key={i} className="pill" onClick={() => setPage(i)} style={{ background: i === page ? "#CFF500" : "#26242e", color: i === page ? "#000" : "#fff" }}>{i + 1}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {list.map(e => {
          const c = CLIPS[e.id];
          return (
            <section key={e.id}>
              <p style={{ fontSize: 13, fontWeight: 700 }}>{e.id} · {e.title}</p>
              <div style={{ position: "relative", aspectRatio: "16/9" }}>
                <YouTubeClip clip={c} label={e.title} />
              </div>
              <p style={{ fontSize: 11, color: "#aaa" }}>{c.channel} · {c.start}s–{c.end}s · <a href={watchUrl(c)} target="_blank" rel="noreferrer">abrir</a></p>
            </section>
          );
        })}
      </div>
    </main>
  );
}
