import type { IsoDateTime } from '@goodboy/types';
import type { ReleaseEntry } from '../../../features/changelog/parseChangelog';

export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading-bg'
  | 'ready'
  | 'downloading'
  | 'uptodate'
  | 'error';

export type UpdateFailure = {
  readonly phase: 'check' | 'download' | 'install';
  readonly message: string;
};

export type UpdateProgress = {
  readonly downloaded: number;
  readonly total: number | null;
};

export type UpdaterState = {
  readonly updaterStatus: UpdaterStatus;
  readonly updateVersion: string | null;
  readonly updateNotes: ReleaseEntry | null;
  readonly updateFailure: UpdateFailure | null;
  readonly updateProgress: UpdateProgress | null;
  readonly updateCheckedAt: IsoDateTime | null;
  readonly updateQueuedUntilIdle: boolean;
};

export const initialUpdaterState: UpdaterState = {
  updaterStatus: 'idle',
  updateVersion: null,
  updateNotes: null,
  updateFailure: null,
  updateProgress: null,
  updateCheckedAt: null,
  updateQueuedUntilIdle: false,
};
