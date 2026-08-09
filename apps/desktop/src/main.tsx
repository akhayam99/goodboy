import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RemoteImageLoaderProvider } from '@goodboy/ui';
import { App } from './App';
import { ErrorBoundary } from './app/components/ErrorBoundary';
import { bootstrapTheme } from './shared/lib/theme';
import { loadRemoteImage } from './shared/lib/remoteImage';
import './styles.css';

bootstrapTheme();

const container = document.getElementById('root');
if (!container) {
  throw new Error('root element not found');
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <RemoteImageLoaderProvider load={loadRemoteImage}>
        <App />
      </RemoteImageLoaderProvider>
    </ErrorBoundary>
  </StrictMode>,
);
