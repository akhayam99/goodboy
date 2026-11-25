import { StrictMode, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { startConsent } from './consent/startConsent';
import { startTracking } from './startTracking';
import { syncDemoLinks } from './syncDemoLinks';

type Params = {
  readonly container?: HTMLElement | null;
  readonly children: ReactNode;
};

export const mountRoot = ({ container = document.getElementById('root'), children }: Params) => {
  if (container === null) {
    throw new Error('mountRoot: no container element');
  }
  syncDemoLinks();
  startTracking();
  const element = <StrictMode>{children}</StrictMode>;
  if (import.meta.env.DEV || container.firstElementChild === null) {
    container.replaceChildren();
    const root = createRoot(container);
    flushSync(() => {
      root.render(element);
    });
    startConsent();
    return;
  }
  startConsent();
  hydrateRoot(container, element);
};
