import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[error-boundary]', error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  reload = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        className="flex h-screen w-screen flex-col items-center justify-center bg-background p-6 text-foreground"
      >
        <div className="flex max-w-md flex-col gap-4 rounded-lg border border-danger/40 bg-subtle p-6 shadow-md">
          <h1 className="text-base font-semibold tracking-tight">something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            kAY.am hit a runtime error and stopped rendering. your data is safe: sessions, agents,
            and providers are all persisted to disk. reload to recover.
          </p>
          <pre className="overflow-auto rounded bg-muted px-3 py-2 text-xs text-danger">
            {this.state.error.message}
          </pre>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={this.reload}
              className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              reload
            </button>
            <button
              type="button"
              onClick={this.reset}
              className="rounded border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
