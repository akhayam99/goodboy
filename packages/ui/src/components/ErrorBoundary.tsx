import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { ScrollFade } from './ScrollFade';

export type ErrorReportRequest = {
  readonly error: Error;
  readonly componentStack: string | null;
};

export type ErrorReportOutcome =
  { readonly kind: 'opened' } | { readonly kind: 'failed'; readonly url: string };

type ReportSlot =
  | {
      readonly onReport: (request: ErrorReportRequest) => Promise<ErrorReportOutcome>;
      readonly reportSummary: string;
    }
  | { readonly onReport?: undefined; readonly reportSummary?: undefined };

type ErrorBoundaryProps = { readonly children: ReactNode } & ReportSlot;

type ReportFailure =
  { readonly kind: 'unopened'; readonly url: string } | { readonly kind: 'unbuilt' };

type ErrorBoundaryState = {
  readonly error: Error | null;
  readonly componentStack: string | null;
  readonly reportFailure: ReportFailure | null;
};

const CLEARED_STATE: ErrorBoundaryState = {
  error: null,
  componentStack: null,
  reportFailure: null,
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = CLEARED_STATE;

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, componentStack: null, reportFailure: null };
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

  report = (): void => {
    const { onReport } = this.props;
    const { error, componentStack } = this.state;
    if (onReport == null || error === null) {
      return;
    }

    void onReport({ error, componentStack })
      .then((outcome) => {
        this.setState({
          reportFailure: outcome.kind === 'failed' ? { kind: 'unopened', url: outcome.url } : null,
        });
      })
      .catch(() => {
        this.setState({ reportFailure: { kind: 'unbuilt' } });
      });
  };

  override render(): ReactNode {
    const { error, reportFailure } = this.state;
    const { onReport, reportSummary } = this.props;
    if (error === null) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        className="flex h-screen w-screen flex-col items-center justify-center bg-background p-6 text-foreground"
      >
        <div className="flex max-w-md flex-col gap-4 rounded-lg border border-danger/40 bg-subtle p-6 shadow-md">
          <h1 className="text-base font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            Goodboy hit a runtime error and stopped rendering. Your data is safe: sessions, agents,
            and providers are all persisted to disk. Try again first, and reload only if the screen
            comes back broken.
          </p>
          <ScrollFade className="max-h-40" viewportClassName="rounded bg-muted px-3 py-2">
            <pre className="whitespace-pre-wrap break-words text-xs text-danger">
              {error.message}
            </pre>
          </ScrollFade>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.reload}
              className="rounded border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              Reload
            </button>
            {onReport != null && (
              <button
                type="button"
                onClick={this.report}
                aria-label="Report this on GitHub"
                className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
              >
                Report this
                <ExternalLink size={11} aria-hidden />
              </button>
            )}
          </div>
          {reportSummary != null && (
            <p className="text-2xs leading-relaxed text-muted-foreground">{reportSummary}</p>
          )}
          {reportFailure != null && reportFailure.kind === 'unopened' && (
            <p className="text-2xs leading-relaxed text-warning">
              Goodboy could not open your browser. Copy this address into it:{' '}
              <span className="select-all break-all font-mono text-muted-foreground">
                {reportFailure.url}
              </span>
            </p>
          )}
          {reportFailure != null && reportFailure.kind === 'unbuilt' && (
            <p className="text-2xs leading-relaxed text-warning">
              Goodboy could not build the report link. Open an issue on GitHub and paste the message
              above.
            </p>
          )}
        </div>
      </div>
    );
  }
}
