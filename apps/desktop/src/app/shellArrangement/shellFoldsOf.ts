import type { DrawerSizing } from '@goodboy/ui';

type Params = {
  readonly paneSizing: DrawerSizing | null;
};

export type ShellFolds = {
  readonly isRailNarrow: boolean;
};

export const shellFoldsOf = ({ paneSizing }: Params): ShellFolds => ({
  isRailNarrow: paneSizing === 'reader',
});
