import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { FeaturesPage } from './FeaturesPage';
import '../../styles.css';
import '../../styles/consent.css';

hydrateRoot(
  document.getElementById('root')!,
  <StrictMode>
    <FeaturesPage />
  </StrictMode>,
);
