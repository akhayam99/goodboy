import { StrictMode, type ReactNode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';

type Params = {
  readonly container: HTMLElement;
  readonly children: ReactNode;
};

export const mountRoot = ({ container, children }: Params) => {
  const element = <StrictMode>{children}</StrictMode>;
  if (import.meta.env.DEV || container.firstElementChild === null) {
    container.replaceChildren();
    createRoot(container).render(element);
    return;
  }
  hydrateRoot(container, element);
};
