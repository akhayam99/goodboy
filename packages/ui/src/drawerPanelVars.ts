import type { CSSProperties } from 'react';

export const DRAWER_PANEL_VARS = {
  dock: '--goodboy-drawer-panel',
  detail: '--goodboy-detail-panel',
} as const satisfies Readonly<Record<string, `--${string}`>>;

type PanelVar = (typeof DRAWER_PANEL_VARS)[keyof typeof DRAWER_PANEL_VARS];

export type PanelVars = CSSProperties & Readonly<Record<PanelVar, string>>;
