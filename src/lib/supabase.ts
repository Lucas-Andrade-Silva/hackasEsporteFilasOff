"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Chave publicável (anon): feita para ficar no navegador. A proteção dos dados
// vem do RLS e das funções no banco, nunca de segredo no cliente.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

export function avatarUrl(path: string | null | undefined, version?: string) {
  const sb = supabase();
  if (!sb || !path) return null;
  const { data } = sb.storage.from("avatars").getPublicUrl(path);
  return version ? `${data.publicUrl}?v=${encodeURIComponent(version)}` : data.publicUrl;
}

const ERRORS: Record<string, string> = {
  "Invalid login credentials": "Email ou senha incorretos.",
  "Email not confirmed": "Confirme seu email antes de entrar. O link chegou na sua caixa de entrada.",
  "User already registered": "Já existe uma conta com esse email. Entre com sua senha.",
  ADULT_CONFIRMATION_REQUIRED: "O Atleta10 é só para maiores de 18 anos.",
  GROUP_NOT_FOUND: "Nenhum grupo com esse código.",
  GROUP_FULL: "Esse grupo já tem 50 pessoas.",
  GROUP_LIMIT: "Você já criou 10 grupos.",
};

export function friendlyError(message: string | undefined) {
  if (!message) return "Algo deu errado. Tente de novo.";
  const key = Object.keys(ERRORS).find(k => message.includes(k));
  if (key) return ERRORS[key];
  if (/password/i.test(message)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/rate limit/i.test(message)) return "Muitas tentativas seguidas. Espere um pouco e tente de novo.";
  if (/Database error saving new user/i.test(message)) return "Não foi possível criar a conta. Confira se você confirmou ter 18 anos ou mais.";
  return "Algo deu errado. Tente de novo.";
}
