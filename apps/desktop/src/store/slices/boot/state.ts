import type { NewerDatabase } from '../../../shared/lib/newerDatabase';
import type { DetectedBrowser, DetectedEditor } from '../../../shared/lib/editor';

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
  readonly detectedBrowsers: ReadonlyArray<DetectedBrowser>;
  readonly boardReady: boolean;
};

export const bootInitialState: BootState = {
  hydrated: false,
  bootPhase: 'pending',
  bootFailedPhase: null,
  newerDatabase: null,
  error: null,
  detectedEditors: [],
  detectedBrowsers: [],
  boardReady: true,
};
