import { LEAGUE_TIERS } from "@/lib/catalog";

export default function LeagueBadge({ tier, size = 64 }: { tier: number; size?: number }) {
  const t = LEAGUE_TIERS[tier] ?? LEAGUE_TIERS[0];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label={`Divisão ${t.name}`} role="img">
      <path d="M32 3 57 17v30L32 61 7 47V17z" fill={t.color} />
      <path d="M32 11 50 21v22L32 53 14 43V21z" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="2" />
      <text x="32" y="38" textAnchor="middle" fontSize="16" fontWeight="900" fill="#fff" fontFamily="system-ui">{tier + 1}</text>
    </svg>
  );
}
