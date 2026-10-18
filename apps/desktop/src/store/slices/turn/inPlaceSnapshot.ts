import type { Project, ProviderRunId, SessionId } from '@goodboy/types';

export type InPlaceSnapshotParams = Readonly<{
  sessionId: SessionId;
  runId: ProviderRunId;
  folders: ReadonlyArray<Project>;
}>;

type InPlaceCapture = Readonly<{
  finalize: () => Promise<void>;
  discard: () => Promise<void>;
}>;

type InPlaceSnapshotPort = Readonly<{
  begin: (params: InPlaceSnapshotParams) => Promise<InPlaceCapture | null>;
}>;

type InstallParams = Readonly<{ port: InPlaceSnapshotPort }>;

const NO_SNAPSHOT: InPlaceSnapshotPort = { begin: async () => null };

const createInPlaceSnapshot = () => {
  let current: InPlaceSnapshotPort = NO_SNAPSHOT;
  const begin = (params: InPlaceSnapshotParams): Promise<InPlaceCapture | null> =>
    current.begin(params);
  const install = ({ port }: InstallParams): void => {
    current = port;
  };
  const reset = (): void => {
    current = NO_SNAPSHOT;
  };
  return { begin, install, reset };
};

export const inPlaceSnapshot = createInPlaceSnapshot();
