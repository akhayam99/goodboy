import type { MountId } from '@goodboy/types';

export type TurnFilesEntry = {
  readonly mountId: MountId;
  readonly paths: ReadonlyArray<string>;
  readonly recordedAtMs: number;
};
