export const BOOT_MARK_NAMES = [
  'script',
  'pending',
  'migrating',
  'loading-settings',
  'detecting-cli',
  'loading-workspaces',
  'restoring-session',
  'ready',
  'hydrated',
  'board',
  'splash',
] as const;

export type BootMarkName = (typeof BOOT_MARK_NAMES)[number];
