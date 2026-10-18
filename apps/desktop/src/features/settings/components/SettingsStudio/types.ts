import type { ReactNode } from 'react';

export type ScopeFrameParts = {
  readonly detail: ReactNode;
};

export type ScopeFrame = (parts: ScopeFrameParts) => ReactNode;
