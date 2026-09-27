import { Component, type ErrorInfo, type ReactNode } from 'react';
import { cn } from '../cn';
import { tintClasses } from '../tint';
import { ScrollFade } from './ScrollFade';

const dangerTint = tintClasses('danger');

export type ErrorReportRequest = {
  readonly error: Error;
  readonly componentStack: string | null;
};

type ErrorBoundaryProps = {
  readonly children: ReactNode;
  readonly describeError?: (error: Error) => string;
  readonly renderReport?: (request: ErrorReportRequest) => ReactNode;
};

type ErrorBoundaryState = {
  readonly error: Error | null;
  readonly componentStack: string | null;
};

const CLEARED_STATE: ErrorBoundaryState = {
  error: null,
  componentStack: null,
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = CLEARED_STATE;

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, componentStack: null };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[error-boundary]', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  reset = (): void => {
    this.setState(CLEARED_STATE);
  };

  reload = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    const { error, componentStack } = this.state;
    const { describeError, renderReport } = this.props;
    if (error === null) {
      return this.props.children;
    }

    return (
      <ScrollFade
        className="h-screen w-screen bg-background"
        viewportClassName="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-foreground"
      >
        <div
          role="alert"
          className={cn(
            'flex w-full max-w-xl flex-col gap-4 rounded-lg border bg-subtle p-6 shadow-md',
            dangerTint.border,
          )}
        >
          <h1 className="text-base font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-body text-muted-foreground">
            Goodboy hit a runtime error and stopped rendering. Your data is safe: sessions, agents,
            and providers are all persisted to disk. Try again first, and reload only if the screen
            comes back broken.
          </p>
          <ScrollFade className="max-h-40" viewportClassName="rounded-sm bg-muted px-3 py-2">
            <pre className="whitespace-pre-wrap break-words text-label text-danger">
              {describeError == null ? error.message : describeError(error)}
            </pre>
          </ScrollFade>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="rounded-sm bg-primary px-3 py-1.5 text-label font-semibold text-on-tone hover:opacity-90"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.reload}
              className="rounded-sm border border-border px-3 py-1.5 text-label font-semibold text-foreground hover:bg-hover"
            >
              Reload
            </button>
          </div>
        </div>
        {renderReport != null ? (
          <div className="w-full max-w-xl">{renderReport({ error, componentStack })}</div>
        ) : null}
      </ScrollFade>
    );
  }
}
