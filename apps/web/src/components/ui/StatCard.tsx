import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: 'default' | 'primary' | 'warn';
  /** Konten skeleton (mencegah layout shift). */
  loading?: boolean;
  footer?: ReactNode;
}

/** Kartu statistik dashboard (FR-10.2, D-08) — grid 2x2 di mobile, 4 kolom di desktop. */
export function StatCard({ label, value, hint, icon: Icon, tone = 'default', loading, footer }: StatCardProps) {
  const toneClass =
    tone === 'primary' ? 'text-primary-dark' : tone === 'warn' ? 'text-[#B45309]' : 'text-ink';
  return (
    <div className="card flex flex-col gap-2 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-label font-semibold text-muted">{label}</p>
        <Icon aria-hidden="true" size={18} className="shrink-0 text-primary" />
      </div>
      {loading ? (
        <div className="h-8 w-20 animate-pulse rounded bg-line" aria-hidden="true" />
      ) : (
        <p className={`text-h1 font-bold ${toneClass}`}>{value}</p>
      )}
      {hint ? <p className="text-badge text-muted">{hint}</p> : null}
      {footer}
    </div>
  );
}
