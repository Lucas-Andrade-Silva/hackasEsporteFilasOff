"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { SportChoice, Space } from "./catalog";

export type Profile = {
  id: string;
  display_name: string;
  avatar_path: string | null;
  bio: string | null;
  sport: SportChoice;
  position: string | null;
  years_playing: "lt1" | "1to3" | "gt3" | null;
  weekly_sessions: "0to1" | "2to3" | "4plus" | null;
  goal: "jump" | "agility" | "skills" | "friends" | "visibility" | null;
  recording_space: Space | null;
  height_cm: number | null;
  weight_kg: number | null;
  coins: number;
  created_at: string;
  updated_at: string;
};

export type Activity = {
  id: string;
  exercise_id: string;
  score: number;
  passed: boolean;
  coins_awarded: number;
  created_at: string;
};

type AuthState = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  activities: Activity[];
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const sb = supabase();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (s: Session | null) => {
    if (!sb || !s) { setProfile(null); setActivities([]); return; }
    const [p, a] = await Promise.all([
      sb.from("profiles").select("*").eq("id", s.user.id).maybeSingle(),
      sb.from("activities").select("id,exercise_id,score,passed,coins_awarded,created_at")
        .order("created_at", { ascending: false }).limit(500),
    ]);
    setProfile((p.data as Profile | null) ?? null);
    setActivities((a.data as Activity[] | null) ?? []);
  }, [sb]);

  useEffect(() => {
    if (!sb) { setLoading(false); return; }
    let alive = true;
    sb.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await load(data.session);
      if (alive) setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      void load(s);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [sb, load]);

  const refresh = useCallback(async () => { await load(session); }, [load, session]);
  const signOut = useCallback(async () => {
    await sb?.auth.signOut();
    setSession(null); setProfile(null); setActivities([]);
  }, [sb]);

  return (
    <AuthContext.Provider value={{ configured: !!sb, loading, session, profile, activities, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}

/** Login obrigatório: sem sessão, a pessoa vai para as boas-vindas. */
export function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!auth.loading && !auth.session) router.replace("/bem-vindo");
  }, [auth.loading, auth.session, router]);
  return { ...auth, ready: !auth.loading && !!auth.session && !!auth.profile };
}

/** Dias (AAAA-MM-DD, horário local) em que houve pelo menos uma atividade. */
export function practiceDays(activities: Activity[]) {
  const days = new Set<string>();
  activities.forEach(a => {
    const d = new Date(a.created_at);
    days.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  });
  return days;
}

export function currentStreak(days: Set<string>, today = new Date()) {
  let streak = 0;
  const d = new Date(today);
  const key = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  if (!days.has(key(d))) d.setDate(d.getDate() - 1);
  while (days.has(key(d))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

export function attemptsToday(activities: Activity[], exerciseId: string, today = new Date()) {
  return activities.filter(a => {
    const d = new Date(a.created_at);
    return a.exercise_id === exerciseId && d.toDateString() === today.toDateString();
  }).length;
}
