/** Skeleton list/detail — tinggi tetap agar tidak ada layout shift (Issue 051). */
export function Skeleton({ className = '', lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`} role="status" aria-live="polite" aria-busy="true">
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="h-16 w-full animate-pulse rounded-card bg-line/60" />
      ))}
    </div>
  );
}
