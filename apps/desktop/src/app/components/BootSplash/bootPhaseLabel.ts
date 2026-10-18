import type { BootPhase } from '../../../store/slices/boot/state';

export const BOOT_PHASE_LABEL: Record<BootPhase, string> = {
  pending: 'starting up',
  migrating: 'updating your library',
  'loading-settings': 'loading settings',
  'detecting-cli': 'detecting agents',
  'loading-workspaces': 'loading workspaces',
  'restoring-session': 'restoring your session',
  ready: 'ready',
  error: 'something went wrong',
};
