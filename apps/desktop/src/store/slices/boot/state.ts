import type { NewerDatabase } from '../../../shared/lib/newerDatabase';
import type { DetectedEditor } from '../../../shared/lib/editor';

export type BootPhase =
  | 'pending'
  | 'migrating'
  | 'loading-settings'
  | 'detecting-cli'
  | 'loading-workspaces'
  | 'restoring-session'
  | 'ready'
  | 'error';

export type BootState = {
  readonly hydrated: boolean;
  readonly bootPhase: BootPhase;
  readonly bootFailedPhase: BootPhase | null;
  readonly newerDatabase: NewerDatabase | null;
  readonly error: string | null;
  readonly detectedEditors: ReadonlyArray<DetectedEditor>;
  readonly boardReady: boolean;
};

export const bootInitialState: BootState = {
  hydrated: false,
  bootPhase: 'pending',
  bootFailedPhase: null,
  newerDatabase: null,
  error: null,
  detectedEditors: [],
  boardReady: true,
};
