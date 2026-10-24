export interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? '?';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  return (first + second).toUpperCase();
}

export function Avatar({ name, size = 'md' }: AvatarProps) {
  const dimension = size === 'sm' ? 'h-8 w-8 text-label' : size === 'lg' ? 'h-14 w-14 text-base' : 'h-10 w-10 text-label';
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-pill bg-primary-light font-bold text-primary-dark ${dimension}`}
    >
      {initials(name)}
    </span>
  );
}
