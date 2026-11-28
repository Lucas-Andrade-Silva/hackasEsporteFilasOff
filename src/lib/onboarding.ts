"use client";
import type { Answers } from "./catalog";

// As respostas ficam no aparelho até o cadastro, que as envia ao banco.
const KEY = "mova-onboarding-v1";

export function loadAnswers(): Answers {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return raw && typeof raw === "object" ? raw as Answers : {};
  } catch { return {}; }
}

export function saveAnswers(a: Answers) {
  localStorage.setItem(KEY, JSON.stringify(a));
}

export function clearAnswers() {
  localStorage.removeItem(KEY);
}

export function isComplete(a: Answers) {
  return !!(a.sport && a.position && a.years_playing && a.weekly_sessions && a.goal && a.recording_space && a.adult_confirmed);
}
