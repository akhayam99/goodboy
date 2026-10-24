import { StrictMode, type ReactNode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { syncDemoLinks } from './theme/syncDemoLinks';

type Params = {
  readonly container: HTMLElement;
  readonly children: ReactNode;
};

export const mountRoot = ({ container, children }: Params) => {
  syncDemoLinks();
  const element = <StrictMode>{children}</StrictMode>;
  if (import.meta.env.DEV || container.firstElementChild === null) {
    container.replaceChildren();
    createRoot(container).render(element);
    return;
  }
  hydrateRoot(container, element);
};
