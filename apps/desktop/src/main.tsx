import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { bootstrapTheme } from './shared/lib/theme';
import { migrateLegacyStorageKeys } from './shared/lib/storage-keys';
import './styles.css';

migrateLegacyStorageKeys();
bootstrapTheme();

const container = document.getElementById('root');
if (!container) throw new Error('root element not found');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
