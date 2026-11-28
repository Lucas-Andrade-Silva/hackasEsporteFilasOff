"use client";
import { useEffect, useRef, useState } from "react";
import type { Motion } from "@/lib/catalog";

// Animações 2D dos exercícios: um esqueleto em SVG interpolado entre poses-chave.
// Leve (sem vídeo para baixar) e respeita "reduzir movimento" do sistema.

type Pt = [number, number];
type Pose = { h: Pt; n: Pt; hp: Pt; le: Pt; lh: Pt; re: Pt; rh: Pt; lk: Pt; lf: Pt; rk: Pt; rf: Pt; b?: Pt };
type Clip = { dur: number; frames: { t: number; p: Pose }[]; ball?: "volley" | "basket"; hoop?: boolean; speed?: boolean; net?: boolean };

const shift = (p: Pose, dx: number, dy = 0): Pose => {
  const out = {} as Pose;
  (Object.keys(p) as (keyof Pose)[]).forEach(k => { const v = p[k]!; out[k] = [v[0] + dx, v[1] + dy]; });
  return out;
};
const withBall = (p: Pose, b: Pt): Pose => ({ ...p, b });

const STAND: Pose = { h: [50, 26], n: [50, 34], hp: [50, 58], le: [45, 45], lh: [44, 56], re: [55, 45], rh: [56, 56], lk: [47, 74], lf: [46, 90], rk: [53, 74], rf: [54, 90] };
const CROUCH: Pose = { h: [50, 38], n: [50, 46], hp: [50, 67], le: [44, 56], lh: [41, 66], re: [56, 56], rh: [59, 66], lk: [42, 78], lf: [46, 90], rk: [58, 78], rf: [54, 90] };
const AIR_UP: Pose = { h: [50, 9], n: [50, 17], hp: [50, 41], le: [42, 8], lh: [40, -4], re: [58, 8], rh: [60, -4], lk: [47, 57], lf: [46, 72], rk: [53, 57], rf: [54, 72] };
const READY: Pose = { ...STAND, le: [41, 30], lh: [40, 17], re: [59, 30], rh: [60, 17] };
const READY_CROUCH: Pose = { ...CROUCH, le: [41, 42], lh: [40, 29], re: [59, 42], rh: [60, 29] };
const STANCE_WIDE: Pose = { h: [50, 32], n: [50, 40], hp: [50, 62], le: [42, 47], lh: [36, 43], re: [58, 47], rh: [64, 43], lk: [41, 76], lf: [37, 90], rk: [59, 76], rf: [63, 90] };
const STANCE_NARROW: Pose = { ...STANCE_WIDE, lk: [45, 76], lf: [45, 90], rk: [55, 76], rf: [55, 90], h: [50, 31], n: [50, 39], hp: [50, 61] };
const RUN_A: Pose = { h: [57, 27], n: [55, 35], hp: [50, 58], le: [61, 42], lh: [66, 35], re: [49, 44], rh: [45, 52], lk: [60, 66], lf: [57, 80], rk: [44, 74], rf: [37, 87] };
const RUN_B: Pose = { h: [57, 26], n: [55, 34], hp: [50, 57], le: [49, 44], lh: [45, 52], re: [61, 42], rh: [66, 35], lk: [44, 74], lf: [37, 87], rk: [60, 66], rf: [57, 80] };
const DRIBBLE: Pose = { h: [47, 33], n: [48, 41], hp: [50, 62], le: [42, 49], lh: [39, 57], re: [56, 50], rh: [62, 60], lk: [43, 76], lf: [41, 90], rk: [58, 76], rf: [60, 90] };
const SET: Pose = { ...STAND, le: [41, 26], lh: [45, 15], re: [59, 26], rh: [55, 15] };
const SET_DOWN: Pose = { ...shift(SET, 0, 5), lk: [45, 77], lf: [46, 90], rk: [55, 77], rf: [54, 90] };
const BUMP: Pose = { h: [50, 34], n: [50, 42], hp: [50, 64], le: [46, 51], lh: [50, 60], re: [54, 51], rh: [50, 60], lk: [43, 77], lf: [45, 90], rk: [57, 77], rf: [55, 90] };
const BUMP_UP: Pose = { ...shift(BUMP, 0, -3), lf: [45, 90], rf: [55, 90], lk: [45, 74], rk: [55, 74], le: [46, 47], lh: [50, 54], re: [54, 47], rh: [50, 54] };
const SQUAT_DEEP: Pose = { h: [50, 44], n: [50, 52], hp: [50, 72], le: [44, 58], lh: [46, 52], re: [56, 58], rh: [54, 52], lk: [39, 76], lf: [44, 90], rk: [61, 76], rf: [56, 90] };

const CLIPS: Record<Motion, Clip> = {
  jump: { dur: 2200, frames: [
    { t: 0, p: STAND }, { t: .28, p: CROUCH }, { t: .48, p: AIR_UP }, { t: .68, p: CROUCH }, { t: 1, p: STAND }] },
  block: { dur: 2200, net: true, frames: [
    { t: 0, p: READY }, { t: .28, p: READY_CROUCH }, { t: .48, p: AIR_UP }, { t: .68, p: READY_CROUCH }, { t: 1, p: READY }] },
  approach: { dur: 2600, frames: [
    { t: 0, p: shift(STAND, -28) }, { t: .18, p: shift(RUN_A, -18) }, { t: .32, p: shift(RUN_B, -8) },
    { t: .44, p: shift(CROUCH, 0) }, { t: .6, p: shift(AIR_UP, 6) }, { t: .76, p: shift(CROUCH, 10) },
    { t: .92, p: shift(STAND, 10) }, { t: 1, p: shift(STAND, -28) }] },
  lateral: { dur: 2400, frames: [
    { t: 0, p: shift(STANCE_WIDE, -20) }, { t: .125, p: shift(STANCE_NARROW, -10) }, { t: .25, p: STANCE_WIDE },
    { t: .375, p: shift(STANCE_NARROW, 10) }, { t: .5, p: shift(STANCE_WIDE, 20) }, { t: .625, p: shift(STANCE_NARROW, 10) },
    { t: .75, p: STANCE_WIDE }, { t: .875, p: shift(STANCE_NARROW, -10) }, { t: 1, p: shift(STANCE_WIDE, -20) }] },
  sprint: { dur: 700, speed: true, frames: [
    { t: 0, p: RUN_A }, { t: .5, p: RUN_B }, { t: 1, p: RUN_A }] },
  dribble: { dur: 800, ball: "basket", frames: [
    { t: 0, p: withBall(DRIBBLE, [62, 65]) },
    { t: .5, p: withBall({ ...DRIBBLE, re: [56, 49], rh: [62, 56] }, [63, 86]) },
    { t: 1, p: withBall(DRIBBLE, [62, 65]) }] },
  shot: { dur: 2800, ball: "basket", hoop: true, frames: [
    { t: 0, p: withBall({ ...STAND, le: [45, 44], lh: [48, 40], re: [55, 44], rh: [52, 40] }, [50, 36]) },
    { t: .22, p: withBall({ ...CROUCH, le: [45, 54], lh: [48, 50], re: [55, 54], rh: [52, 50] }, [50, 46]) },
    { t: .42, p: withBall(AIR_UP, [52, -8]) },
    { t: .58, p: withBall({ ...AIR_UP, h: [50, 13], n: [50, 21], hp: [50, 45], lk: [47, 61], lf: [46, 76], rk: [53, 61], rf: [54, 76] }, [70, -12]) },
    { t: .72, p: withBall(CROUCH, [84, 0]) },
    { t: .84, p: withBall(STAND, [85, 14]) },
    { t: 1, p: withBall({ ...STAND, le: [45, 44], lh: [48, 40], re: [55, 44], rh: [52, 40] }, [50, 36]) }] },
  set: { dur: 1400, ball: "volley", frames: [
    { t: 0, p: withBall(SET_DOWN, [50, 9]) }, { t: .5, p: withBall(SET, [50, -11]) }, { t: 1, p: withBall(SET_DOWN, [50, 9]) }] },
  bump: { dur: 1500, ball: "volley", frames: [
    { t: 0, p: withBall(BUMP, [50, 55]) }, { t: .15, p: withBall(BUMP_UP, [50, 44]) },
    { t: .5, p: withBall(BUMP, [50, -4]) }, { t: 1, p: withBall(BUMP, [50, 55]) }] },
  serve: { dur: 2600, ball: "volley", frames: [
    { t: 0, p: withBall({ ...STAND, le: [44, 44], lh: [40, 46] }, [40, 42]) },
    { t: .25, p: withBall({ ...STAND, le: [44, 28], lh: [43, 18], re: [58, 30], rh: [62, 22] }, [43, 10]) },
    { t: .45, p: withBall({ ...STAND, le: [45, 30], lh: [44, 22], re: [60, 26], rh: [62, 14] }, [46, -6]) },
    { t: .58, p: withBall({ ...STAND, le: [45, 40], lh: [42, 48], re: [54, 22], rh: [50, 9] }, [50, -6]) },
    { t: .78, p: withBall({ ...STAND, le: [45, 44], lh: [43, 54], re: [52, 44], rh: [46, 54] }, [92, -12]) },
    { t: .9, p: withBall({ ...STAND, le: [44, 44], lh: [40, 46] }, [104, -14]) },
    { t: 1, p: withBall({ ...STAND, le: [44, 44], lh: [40, 46] }, [40, 42]) }] },
  squat: { dur: 2000, frames: [
    { t: 0, p: STAND }, { t: .3, p: SQUAT_DEEP }, { t: .5, p: shift(STAND, 0, -10) }, { t: .7, p: SQUAT_DEEP }, { t: 1, p: STAND }] },
};

const ease = (x: number) => (x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

function poseAt(clip: Clip, t: number): Pose {
  const f = clip.frames;
  let i = 0;
  while (i < f.length - 2 && t > f[i + 1].t) i++;
  const a = f[i], b = f[i + 1];
  const k = ease(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t || 1))));
  const out = {} as Pose;
  (Object.keys(a.p) as (keyof Pose)[]).forEach(key => {
    const va = a.p[key], vb = b.p[key] ?? va;
    if (va && vb) out[key] = [va[0] + (vb[0] - va[0]) * k, va[1] + (vb[1] - va[1]) * k];
  });
  return out;
}

const LIMBS: [keyof Pose, keyof Pose][] = [
  ["n", "hp"], ["n", "le"], ["le", "lh"], ["n", "re"], ["re", "rh"],
  ["hp", "lk"], ["lk", "lf"], ["hp", "rk"], ["rk", "rf"],
];

export default function MotionFigure({ motion, playing = true, label, className = "" }: {
  motion: Motion; playing?: boolean; label?: string; className?: string;
}) {
  const clip = CLIPS[motion];
  const [t, setT] = useState(.45);
  const start = useRef<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!playing || reduce) return;
    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    if (ref.current) io.observe(ref.current);
    const tick = (now: number) => {
      if (start.current === null) start.current = now;
      if (visible) setT(((now - start.current) % clip.dur) / clip.dur);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [playing, clip.dur]);

  const p = poseAt(clip, t);
  const footY = Math.max(p.lf[1], p.rf[1]);
  const lift = Math.max(0, 90 - footY);
  const gid = `g-${motion}`;

  return (
    <svg ref={ref} className={`motion ${className}`} viewBox="0 -16 100 112" role="img"
      aria-label={label ?? "Animação do exercício"} preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id={gid} cx="50%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#3A1D78" />
          <stop offset="55%" stopColor="#15111F" />
          <stop offset="100%" stopColor="#0B0B0F" />
        </radialGradient>
      </defs>
      <rect x="-300" y="-20" width="700" height="130" fill={`url(#${gid})`} />
      <g stroke="#FFFFFF" strokeOpacity=".08" strokeWidth=".4">
        {[-160, -120, -80, -40, -20, 0, 20, 40, 60, 80, 100, 120, 140, 180, 220, 260].map(x => <line key={x} x1={50 + (x - 50) * .35} y1="92" x2={x} y2="110" />)}
      </g>
      <line x1="-300" y1="92" x2="400" y2="92" stroke="#CFF500" strokeOpacity=".55" strokeWidth=".7" />
      {clip.net && <g stroke="#FFFFFF" strokeOpacity=".22" strokeWidth=".5">
        <line x1="-80" y1="2" x2="180" y2="2" />
        {Array.from({ length: 53 }, (_, i) => <line key={i} x1={-80 + i * 5} y1="2" x2={-80 + i * 5} y2="12" />)}
        <line x1="-80" y1="12" x2="180" y2="12" />
      </g>}
      {clip.hoop && <g fill="none" strokeLinecap="round">
        <line x1="95" y1="-14" x2="95" y2="12" stroke="#FFFFFF" strokeOpacity=".5" strokeWidth="1.2" />
        <line x1="80" y1="4" x2="94" y2="4" stroke="#FF7A1A" strokeWidth="1.4" />
        <path d="M81 4 L83 12 L91 12 L93 4" stroke="#FFFFFF" strokeOpacity=".35" strokeWidth=".5" />
      </g>}
      {clip.speed && <g stroke="#CFF500" strokeOpacity=".5" strokeWidth=".8" strokeLinecap="round">
        <line x1="14" y1="40" x2="30" y2="40" /><line x1="8" y1="52" x2="28" y2="52" /><line x1="16" y1="64" x2="32" y2="64" />
      </g>}
      <ellipse cx={(p.lf[0] + p.rf[0]) / 2} cy="92.5" rx={Math.max(4, 11 - lift * .25)} ry="1.6"
        fill="#000" opacity={Math.max(.15, .5 - lift * .015)} />
      <g stroke="#CFF500" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {LIMBS.map(([a, b]) => <line key={a + b} x1={p[a]![0]} y1={p[a]![1]} x2={p[b]![0]} y2={p[b]![1]} />)}
      </g>
      <circle cx={p.h[0]} cy={p.h[1]} r="5.4" fill="#CFF500" />
      {p.b && clip.ball === "basket" && <g>
        <circle cx={p.b[0]} cy={p.b[1]} r="4.2" fill="#FF7A1A" />
        <path d={`M${p.b[0] - 4.2} ${p.b[1]}h8.4M${p.b[0]} ${p.b[1] - 4.2}v8.4`} stroke="#5A2400" strokeWidth=".5" />
      </g>}
      {p.b && clip.ball === "volley" && <g>
        <circle cx={p.b[0]} cy={p.b[1]} r="4.2" fill="#FFFFFF" />
        <path d={`M${p.b[0] - 3.6} ${p.b[1] - 2}q3.6 2 7.2 0M${p.b[0] - 3.6} ${p.b[1] + 2}q3.6 -2 7.2 0`} stroke="#7B3FF2" strokeWidth=".7" fill="none" />
      </g>}
    </svg>
  );
}
