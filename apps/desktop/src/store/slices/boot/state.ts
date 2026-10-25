import type { NewerDatabase } from '../../../shared/lib/newerDatabase';
import type { DetectedBrowser, DetectedEditor } from '../../../shared/lib/editor';
import type { DetectedTerminal } from '../../../shared/lib/terminalApp';

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
  readonly detectedTerminals: ReadonlyArray<DetectedTerminal>;
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
  detectedTerminals: [],
  boardReady: true,
};
