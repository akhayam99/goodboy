export const DRAWER_PANEL_VARS = {
  dock: '--goodboy-drawer-panel',
  detail: '--goodboy-detail-panel',
} as const satisfies Readonly<Record<string, `--${string}`>>;
