import { useTranslation } from 'react-i18next';
import type { PriorityLabel } from '@swp/shared';

export interface PriorityBadgeProps {
  label: PriorityLabel;
  /** Skor ditampilkan bila dimintai (popup detail / pratinjau form). */
  score?: number;
  size?: 'sm' | 'md';
}

/**
 * Badge prioritas: warna konsisten (TOP merah tua, HIGH merah, MEDIUM kuning, LOW hijau) dan
 * **selalu** disertai teks label, bukan hanya warna (D-27, Issue 035).
 */
const STYLES: Record<PriorityLabel, string> = {
  TOP: 'bg-top text-white',
  HIGH: 'bg-[#FEE2E2] text-[#991B1B]',
  MEDIUM: 'bg-[#FEF9C3] text-[#713F12]',
  LOW: 'bg-[#DCFCE7] text-[#14532D]',
};

const DOT: Record<PriorityLabel, string> = {
  TOP: 'bg-white',
  HIGH: 'bg-high',
  MEDIUM: 'bg-medium',
  LOW: 'bg-low',
};

export function PriorityBadge({ label, score, size = 'md' }: PriorityBadgeProps) {
  const { t } = useTranslation();
  return (
    <span className={`badge ${STYLES[label]} ${size === 'sm' ? 'px-2 py-0.5' : ''}`}>
      <span aria-hidden="true" className={`h-2 w-2 rounded-pill ${DOT[label]}`} />
      {t(`priority.${label}`)}
      {score != null ? <span className="font-normal opacity-90">· {score.toFixed(1)}</span> : null}
    </span>
  );
}
