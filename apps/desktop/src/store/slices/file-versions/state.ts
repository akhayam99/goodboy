import type { SessionId, FileVersion } from '@goodboy/types';

export type FileVersionsState = {
  readonly sessionFileVersions: Readonly<Record<SessionId, ReadonlyArray<FileVersion> | undefined>>;
  readonly sessionFileVersionsLoading: Readonly<Record<SessionId, boolean>>;
  readonly sessionFileVersionSelectedPath: Readonly<Record<SessionId, string | null>>;
};

export const fileVersionsInitialState: FileVersionsState = {
  sessionFileVersions: {},
  sessionFileVersionsLoading: {},
  sessionFileVersionSelectedPath: {},
};
