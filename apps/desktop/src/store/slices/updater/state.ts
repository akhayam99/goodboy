import type { IsoDateTime } from '@goodboy/types';

type UpdaterStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'uptodate' | 'error';

export type UpdateFailure = {
  readonly phase: 'check' | 'install';
  readonly message: string;
};

export type UpdateProgress = {
  readonly downloaded: number;
  readonly total: number | null;
};

export type UpdaterState = {
  readonly updaterStatus: UpdaterStatus;
  readonly updateVersion: string | null;
  readonly updateFailure: UpdateFailure | null;
  readonly updateProgress: UpdateProgress | null;
  readonly updateCheckedAt: IsoDateTime | null;
};

export const initialUpdaterState: UpdaterState = {
  updaterStatus: 'idle',
  updateVersion: null,
  updateFailure: null,
  updateProgress: null,
  updateCheckedAt: null,
};
