import type { DrawerMode } from './drawerGeometry';
import { createContext, type Dispatch, type SetStateAction } from 'react';

type DrawerContentMetrics = {
  readonly mode: DrawerMode;
  readonly columnWidth: number | null;
  readonly savedWidth: number;
  readonly setInset: Dispatch<SetStateAction<number>>;
};

export const DrawerContentContext = createContext<DrawerContentMetrics | null>(null);
