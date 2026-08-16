import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { getVersion } from '@tauri-apps/api/app';
import {
  ErrorBoundary,
  RemoteImageLoaderProvider,
  type ErrorReportOutcome,
  type ErrorReportRequest,
} from '@goodboy/ui';
import { App } from './App';
import { bootstrapTheme } from './shared/lib/theme';
import { loadRemoteImage } from './shared/lib/remoteImage';
import { openUrl } from './shared/lib/editor';
import { buildCrashReport, CRASH_TRACE_BUDGET } from './features/settings/buildCrashReport';
import './styles.css';

bootstrapTheme();

const REPORT_SUMMARY = `The report carries the error message above and where it broke in the app, with home folders shortened to ~ and that part cut to at most ${CRASH_TRACE_BUDGET} characters. Reporting opens a prefilled GitHub issue form in your browser, so the text reaches GitHub as the page loads. Nothing is posted until you submit it there.`;

const reportCrash = async ({
  error,
  componentStack,
}: ErrorReportRequest): Promise<ErrorReportOutcome> => {
  const version = await getVersion().catch(() => null);
  const { url } = buildCrashReport({ error, componentStack, version });
  try {
    await openUrl(url);
    return { kind: 'opened' };
  } catch {
    return { kind: 'failed', url };
  }
};

const container = document.getElementById('root');
if (!container) {
  throw new Error('root element not found');
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary onReport={reportCrash} reportSummary={REPORT_SUMMARY}>
      <RemoteImageLoaderProvider load={loadRemoteImage}>
        <App />
      </RemoteImageLoaderProvider>
    </ErrorBoundary>
  </StrictMode>,
);
