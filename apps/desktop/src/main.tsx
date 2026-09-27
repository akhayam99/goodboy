import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  CodeHighlighterContext,
  ErrorBoundary,
  RemoteImageLoaderProvider,
  type ErrorReportRequest,
} from '@goodboy/ui';
import { App } from './App';
import { MockScene } from './app/components/MockScene';
import { ScrollerStyleProvider } from './shared/components/ScrollerStyleProvider';
import { MOCK_ENABLED } from './store/mock-data';
import { bootstrapTheme } from './shared/lib/theme';
import { loadRemoteImage } from './shared/lib/remoteImage';
import { APP_CODE_HIGHLIGHTER } from './features/diff/lib/highlight/codeHighlighter';
import { CrashReport } from './features/bug-report/components/CrashReport';
import { crashKind, crashPart, describeCrash } from './features/bug-report/crashReport';
import './styles.css';

bootstrapTheme();

const renderCrashReport = ({ error, componentStack }: ErrorReportRequest) => (
  <CrashReport
    heading="Report this crash"
    initialLine={`Crash: ${crashKind({ error })}`}
    errorPart={crashPart({ message: error.message, stack: error.stack, componentStack })}
  />
);

const container = document.getElementById('root');
if (!container) {
  throw new Error('root element not found');
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary describeError={describeCrash} renderReport={renderCrashReport}>
      <RemoteImageLoaderProvider load={loadRemoteImage}>
        <CodeHighlighterContext.Provider value={APP_CODE_HIGHLIGHTER}>
          <ScrollerStyleProvider>{MOCK_ENABLED ? <MockScene /> : <App />}</ScrollerStyleProvider>
        </CodeHighlighterContext.Provider>
      </RemoteImageLoaderProvider>
    </ErrorBoundary>
  </StrictMode>,
);
