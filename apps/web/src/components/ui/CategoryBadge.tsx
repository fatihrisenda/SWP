export interface CategoryBadgeProps {
  name: string;
  color: string;
}

export function CategoryBadge({ name, color }: CategoryBadgeProps) {
  return (
    <span className="badge border border-line bg-white text-ink">
      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-pill" style={{ backgroundColor: color }} />
      <span className="max-w-[12ch] truncate">{name}</span>
    </span>
  );
}
