import { createContext, type ReactNode } from 'react';
import type { DockGridSpec } from './dockGridSpec';

export type ShellDock = {
  readonly node: ReactNode;
  readonly grid: DockGridSpec | null;
};

export const ShellDockContext = createContext<ShellDock | null>(null);
