import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { bootstrapTheme } from './theme';
import { migrateLegacyStorageKeys } from './storage-keys';
import './styles.css';

migrateLegacyStorageKeys();
bootstrapTheme();

const container = document.getElementById('root');
if (!container) throw new Error('root element not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
