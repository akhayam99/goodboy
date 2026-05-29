export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'uptodate'
  | 'error';

export interface UpdaterState {
  readonly updaterStatus: UpdaterStatus;
  readonly updateVersion: string | null;
  readonly updateError: string | null;
}

export const initialUpdaterState: UpdaterState = {
  updaterStatus: 'idle',
  updateVersion: null,
  updateError: null,
};
