import type { BootPhase } from '../../../store/slices/boot/state';

const BOOT_PHASE_ORDER = [
  'pending',
  'migrating',
  'loading-settings',
  'detecting-cli',
  'loading-workspaces',
  'restoring-session',
  'ready',
] as const satisfies ReadonlyArray<BootPhase>;

type Params = {
  readonly phase: BootPhase;
};

export const bootProgressPercent = ({ phase }: Params): number => {
  const index = BOOT_PHASE_ORDER.findIndex((entry) => entry === phase);
  if (index < 0) {
    return 0;
  }
  return (index / (BOOT_PHASE_ORDER.length - 1)) * 100;
};
