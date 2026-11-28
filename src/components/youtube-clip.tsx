"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { thumb, watchUrl, type Clip } from "@/lib/clips";

// Player oficial do YouTube tocando só o trecho [start, end] em loop, sem som.
// Usa a IFrame API e o domínio youtube-nocookie (sem cookies antes do play).

type YTPlayer = { playVideo(): void; pauseVideo(): void; seekTo(s: number, a: boolean): void; mute(): void; destroy(): void; getPlayerState(): number; getCurrentTime(): number };
type YTNamespace = { Player: new (el: HTMLElement, opts: object) => YTPlayer; PlayerState: { ENDED: number; PLAYING: number } };
declare global { interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void } }

let apiPromise: Promise<YTNamespace> | null = null;
function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise(resolve => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT!); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return apiPromise;
}

export type ClipHandle = { play(): void; pause(): void };

export const YouTubeClip = forwardRef<ClipHandle, { clip: Clip; label: string; autoPlay?: boolean; onPlaying?: (p: boolean) => void }>(
  function YouTubeClip({ clip, label, autoPlay = true, onPlaying }, ref) {
    const host = useRef<HTMLDivElement>(null);
    const player = useRef<YTPlayer | null>(null);

    useImperativeHandle(ref, () => ({
      play: () => player.current?.playVideo(),
      pause: () => player.current?.pauseVideo(),
    }));

    useEffect(() => {
      let alive = true;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // Volta ao início do corte um pouco antes do fim: o player nunca chega ao
      // estado "encerrado", que mostra título e sugestões por cima do vídeo.
      const loop = window.setInterval(() => {
        const p = player.current;
        if (p && typeof p.getCurrentTime === "function" && p.getCurrentTime() >= clip.end - .35) p.seekTo(clip.start, true);
      }, 200);
      loadApi().then(YT => {
        if (!alive || !host.current) return;
        const el = document.createElement("div");
        host.current.appendChild(el);
        player.current = new YT.Player(el, {
          host: "https://www.youtube-nocookie.com",
          videoId: clip.id,
          playerVars: {
            start: clip.start, end: clip.end + 2, autoplay: autoPlay && !reduce ? 1 : 0, mute: 1,
            controls: 0, playsinline: 1, rel: 0, iv_load_policy: 3, disablekb: 1, fs: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (e: { target: YTPlayer }) => { e.target.mute(); if (autoPlay && !reduce) e.target.playVideo(); },
            onStateChange: (e: { data: number; target: YTPlayer }) => {
              if (e.data === YT.PlayerState.ENDED) { e.target.seekTo(clip.start, true); e.target.playVideo(); }
              onPlaying?.(e.data === YT.PlayerState.PLAYING);
            },
          },
        });
      });
      return () => { alive = false; window.clearInterval(loop); player.current?.destroy(); player.current = null; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clip.id, clip.start, clip.end]);

    return (
      <div className="yt" aria-label={label} role="region">
        <img className="yt-poster" src={thumb(clip)} alt="" />
        <div ref={host} className="yt-host" />
      </div>
    );
  },
);

export function ClipCredit({ clip }: { clip: Clip }) {
  return (
    <a className="credit credit-dark" href={watchUrl(clip)} target="_blank" rel="noopener noreferrer">
      Vídeo: {clip.channel} · YouTube
    </a>
  );
}
