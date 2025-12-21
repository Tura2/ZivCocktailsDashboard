import type { ReactNode } from 'react';
import React from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  onGoToLogin?: () => void;
};

type ErrorBoundaryState = {
  errorId: string | null;
  error: Error | null;
};

function newErrorId(): string {
  const anyCrypto = globalThis.crypto as Crypto | undefined;
  if (anyCrypto && typeof anyCrypto.randomUUID === 'function') {
    return anyCrypto.randomUUID();
  }
  return `err_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { errorId: null, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { errorId: newErrorId(), error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // F4 requirement: log to console only (no external logging).
    console.error('UI error boundary caught error', { error, info });
  }

  private copyErrorId = async () => {
    const id = this.state.errorId;
    if (!id) return;

    try {
      await navigator.clipboard.writeText(id);
    } catch {
      // Clipboard can fail in some environments; fall back to prompt.
      window.prompt('Copy error id:', id);
    }
  };

  private reload = () => {
    window.location.reload();
  };

  render() {
    const { errorId, error } = this.state;

    if (!error) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="w-full max-w-xl rounded-lg border bg-white p-6">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-600">
            The app hit an unexpected error. You can reload the app, return to login, or share the error id.
          </p>

          <div className="mt-4 rounded-md bg-gray-50 p-3 text-sm">
            <div className="font-medium">Error id</div>
            <div className="mt-1 font-mono text-xs break-all">{errorId}</div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="rounded-md border px-3 py-2 text-sm" onClick={this.reload}>
              Reload
            </button>
            <button
              className="rounded-md border px-3 py-2 text-sm"
              onClick={() => this.props.onGoToLogin?.()}
            >
              Go to login
            </button>
            <button className="rounded-md border px-3 py-2 text-sm" onClick={this.copyErrorId}>
              Copy error id
            </button>
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-gray-700">Details</summary>
            <pre className="mt-2 overflow-auto rounded-md bg-gray-900 p-3 text-xs text-white">
              {String(error?.stack || error?.message || 'Unknown error')}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
