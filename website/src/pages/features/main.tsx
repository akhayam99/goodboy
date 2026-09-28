import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FeaturesPage } from './FeaturesPage';
import '../../styles.css';
import '../../styles/consent.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FeaturesPage />
  </StrictMode>,
);
