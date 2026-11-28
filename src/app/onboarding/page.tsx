"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CaretLeft, Volleyball, Basketball, ArrowFatLinesUp, Lightning, Target, UsersThree, Eye,
  House, CourtBasketball, Question, HourglassMedium, CalendarCheck,
} from "@phosphor-icons/react";
import {
  POSITIONS, YEARS_LABEL, WEEKLY_LABEL, GOAL_LABEL, SPACE_LABEL, sportsOf, SPORT_LABEL, type Answers,
} from "@/lib/catalog";
import { loadAnswers, saveAnswers } from "@/lib/onboarding";

type Option = { value: string; label: string; icon?: ReactNode; group?: string };
type Step = { key: keyof Answers; kicker: string; title: string; options: (a: Answers) => Option[] };

const I = 24;
const STEPS: Step[] = [
  { key: "sport", kicker: "Seu jogo", title: "Qual é seu esporte?", options: () => [
    { value: "volleyball", label: "Vôlei", icon: <Volleyball size={I} /> },
    { value: "basketball", label: "Basquete", icon: <Basketball size={I} /> },
    { value: "both", label: "Os dois", icon: <span className="row" style={{ gap: 2 }}><Volleyball size={20} /><Basketball size={20} /></span> },
  ] },
  { key: "position", kicker: "Em quadra", title: "Qual é sua posição?", options: a => [
    ...sportsOf(a.sport).flatMap(s => POSITIONS[s].map(p => ({
      value: `${SPORT_LABEL[s]} · ${p}`, label: p, group: a.sport === "both" ? SPORT_LABEL[s] : undefined,
    }))),
    { value: "Ainda não sei", label: "Ainda não sei", icon: <Question size={I} /> },
  ] },
  { key: "years_playing", kicker: "Experiência", title: "Há quanto tempo você joga?", options: () =>
    (Object.keys(YEARS_LABEL) as (keyof typeof YEARS_LABEL)[]).map(k => ({ value: k, label: YEARS_LABEL[k], icon: <HourglassMedium size={I} /> })) },
  { key: "weekly_sessions", kicker: "Rotina", title: "Quantos treinos por semana?", options: () =>
    (Object.keys(WEEKLY_LABEL) as (keyof typeof WEEKLY_LABEL)[]).map(k => ({ value: k, label: WEEKLY_LABEL[k], icon: <CalendarCheck size={I} /> })) },
  { key: "goal", kicker: "Objetivo", title: "O que você mais quer agora?", options: () => [
    { value: "jump", label: GOAL_LABEL.jump, icon: <ArrowFatLinesUp size={I} /> },
    { value: "agility", label: GOAL_LABEL.agility, icon: <Lightning size={I} /> },
    { value: "skills", label: GOAL_LABEL.skills, icon: <Target size={I} /> },
    { value: "friends", label: GOAL_LABEL.friends, icon: <UsersThree size={I} /> },
    { value: "visibility", label: GOAL_LABEL.visibility, icon: <Eye size={I} /> },
  ] },
  { key: "recording_space", kicker: "Onde você treina", title: "Onde vai gravar os exercícios?", options: () => [
    { value: "small", label: SPACE_LABEL.small, icon: <House size={I} /> },
    { value: "large", label: SPACE_LABEL.large, icon: <CourtBasketball size={I} /> },
  ] },
];

export default function Onboarding() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => { setAnswers(loadAnswers()); setReady(true); }, []);

  const total = STEPS.length + 1;
  const isLast = step === STEPS.length;
  const current = STEPS[step];

  const choose = (key: keyof Answers, value: string) => {
    const next: Answers = { ...answers, [key]: value };
    if (key === "sport" && answers.sport !== value) delete next.position;
    setAnswers(next); saveAnswers(next);
    setTimeout(() => setStep(s => Math.min(s + 1, STEPS.length)), 180);
  };

  const back = () => (step === 0 ? router.push("/bem-vindo") : setStep(step - 1));
  const finish = () => {
    const next = { ...answers, adult_confirmed: true };
    saveAnswers(next);
    router.push("/cadastro");
  };

  if (!ready) return null;
  const options = current ? current.options(answers) : [];
  let lastGroup: string | undefined;

  return (
    <main className="flow">
      <div className="flow-head">
        <button className="icon-btn" onClick={back} aria-label="Voltar"><CaretLeft size={24} weight="bold" /></button>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={step + 1}>
          <i style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
        <span className="t-foot muted" style={{ minWidth: 34, textAlign: "right" }}>{step + 1}/{total}</span>
      </div>

      {current && (
        <section className="flow-step" key={current.key}>
          <p className="t-caps">{current.kicker}</p>
          <h1 className="t-large">{current.title}</h1>
          <div className="choices">
            {options.map(o => {
              const header = o.group && o.group !== lastGroup ? <p className="t-caps choice-group" key={"g" + o.group}>{o.group}</p> : null;
              lastGroup = o.group ?? lastGroup;
              return [header,
                <button key={o.value} type="button" className="choice" aria-pressed={answers[current.key] === o.value}
                  onClick={() => choose(current.key, o.value)}>
                  {o.icon && <span className="choice-icon">{o.icon}</span>}{o.label}
                </button>];
            })}
          </div>
        </section>
      )}

      {isLast && (
        <section className="flow-step">
          <p className="t-caps">Último passo</p>
          <h1 className="t-large">Antes de criar sua conta</h1>
          <label className="check">
            <input type="checkbox" checked={!!answers.adult_confirmed}
              onChange={e => { const next = { ...answers, adult_confirmed: e.target.checked }; setAnswers(next); saveAnswers(next); }} />
            <span>Confirmo que tenho 18 anos ou mais. O Atleta10 é só para adultos nesta versão.</span>
          </label>
          <p className="t-foot muted" style={{ marginTop: 14 }}>
            Todo mundo começa do zero: seus exercícios ficam zerados até você fazer cada um pela primeira vez.
            As respostas só escolhem o esporte, a ordem dos treinos e sua missão do dia.
          </p>
        </section>
      )}

      {isLast && (
        <div className="flow-foot">
          <button className="btn btn-primary" disabled={!answers.adult_confirmed} onClick={finish}>Criar minha conta</button>
        </div>
      )}
    </main>
  );
}
