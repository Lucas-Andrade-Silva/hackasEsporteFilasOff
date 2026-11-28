"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  SneakerMove, Ranking, ClockCounterClockwise, IdentificationCard, CoinVertical,
} from "@phosphor-icons/react";
import { avatarUrl } from "@/lib/supabase";

const TABS = [
  { href: "/", label: "Treinos", Icon: SneakerMove },
  { href: "/ranking", label: "Ranking", Icon: Ranking },
  { href: "/evolucao", label: "Evolução", Icon: ClockCounterClockwise },
  { href: "/perfil", label: "Perfil", Icon: IdentificationCard },
];

/** Barra inferior: só ícones. O nome de cada aba fica no aria-label. */
export function TabBar() {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="Navegação principal">
      {TABS.map(({ href, label, Icon }) => {
        const active = href === "/"
          ? path === "/" || path.startsWith("/treinos") || path.startsWith("/exercicio")
          : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-label={label} aria-current={active ? "page" : undefined} className="tab">
            <Icon size={28} weight={active ? "fill" : "regular"} />
            {active && <span className="tab-dot" aria-hidden />}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <>
      <main className={`shell ${wide ? "shell-wide" : ""}`}>{children}</main>
      <TabBar />
    </>
  );
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "M";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ name, path, version, size = 40 }: { name: string; path?: string | null; version?: string; size?: number }) {
  const url = avatarUrl(path, version);
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * .38 }}>
      {url ? <img src={url} alt="" width={size} height={size} /> : initials(name)}
    </span>
  );
}

export function Coins({ value, dark = false }: { value: number; dark?: boolean }) {
  return (
    <span className={`coins ${dark ? "coins-dark" : ""}`} aria-label={`${value} moedas`}>
      <CoinVertical size={18} weight="fill" aria-hidden />
      {value.toLocaleString("pt-BR")}
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label, dark = false }: {
  value: T; options: { value: T; label: ReactNode; aria?: string }[]; onChange: (v: T) => void; label: string; dark?: boolean;
}) {
  return (
    <div className={`segmented ${dark ? "segmented-dark" : ""}`} role="tablist" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} aria-label={o.aria}
          className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Splash() {
  return (
    <div className="splash" aria-busy="true" aria-label="Carregando">
      <span className="wordmark">MOVA</span>
    </div>
  );
}

export function SetupNotice() {
  return (
    <div className="notice">
      <strong>Conexão com o banco pendente.</strong>
      <p>Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY na Vercel para liberar cadastro e login.</p>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="section-title"><h2>{children}</h2>{action}</div>;
}
