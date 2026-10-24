import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="card flex flex-col items-center gap-3 p-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-pill bg-primary-xl">
        <Icon aria-hidden="true" size={24} className="text-primary-dark" />
      </span>
      <p className="text-h2 font-semibold">{title}</p>
      {description ? <p className="max-w-[42ch] text-label text-muted">{description}</p> : null}
      {action}
    </div>
  );
}
