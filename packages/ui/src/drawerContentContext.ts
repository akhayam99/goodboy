import type { DrawerMode } from './drawerGeometry';
import { createContext } from 'react';

type DrawerContentMetrics = {
  readonly mode: DrawerMode;
  readonly columnWidth: number | null;
  readonly savedWidth: number;
};

export const DrawerContentContext = createContext<DrawerContentMetrics | null>(null);
