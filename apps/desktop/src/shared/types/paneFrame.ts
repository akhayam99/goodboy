import type { ReactNode } from 'react';

export type PaneFrame = {
  readonly title: string;
  readonly meta: ReactNode;
  readonly actions: ReactNode;
  readonly tabs: ReactNode;
};
