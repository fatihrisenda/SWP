import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { t as translate } from '../lib/i18n';

interface Props {
  children: ReactNode;
}

interface State {
  errorId: string | null;
}

/** `ErrorBoundary` global (Issue 051 langkah 1): pesan ramah + ID, bukan detail teknis. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { errorId: null };

  static getDerivedStateFromError(): Partial<State> {
    return { errorId: generateId() };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log ke konsol pengembang; **jangan** pernah menampilkan stack ke pengguna.
    console.error('[swp] render error', error.message, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.errorId) return this.props.children;
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-h1 font-bold">{translate('errors.boundary.title')}</h1>
        <p className="text-body text-muted">
          {translate('errors.boundary.body')}{' '}
          <span className="font-mono">{this.state.errorId}</span>
        </p>
        <button
          type="button"
          className="min-h-touch rounded-card bg-primary-dark px-4 font-semibold text-white"
          onClick={() => window.location.reload()}
        >
          {translate('errors.boundary.reload')}
        </button>
      </main>
    );
  }
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}
