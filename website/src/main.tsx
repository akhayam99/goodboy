import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { FidelityView } from './components/FidelityView';
import './styles.css';
import './styles/consent.css';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme');
if (theme === 'dark' || theme === 'light') {
  document.documentElement.dataset.theme = theme;
}

const mountPage = () => {
  const root = document.getElementById('root')!;
  const mock = params.get('fidelity');
  if (mock !== null) {
    root.replaceChildren();
    createRoot(root).render(
      <StrictMode>
        <FidelityView mock={mock} />
      </StrictMode>,
    );
    return;
  }
  hydrateRoot(
    root,
    <StrictMode>
      <App />
    </StrictMode>,
  );
};

mountPage();
