import type { ProviderRunId, SessionId } from '@goodboy/types';

type Capture = Readonly<{
  sessionId: SessionId;
  folderPaths: ReadonlyArray<string>;
}>;

type TrackParams = Readonly<{
  runId: ProviderRunId;
  sessionId: SessionId;
  folderPaths: ReadonlyArray<string>;
}>;

type UntrackParams = Readonly<{ runId: ProviderRunId }>;

type HoldsParams = Readonly<{
  sessionId: SessionId;
  folderPath: string;
}>;

const captures = new Map<ProviderRunId, Capture>();

export const trackFolderCapture = ({ runId, sessionId, folderPaths }: TrackParams): void => {
  captures.set(runId, { sessionId, folderPaths });
};

export const untrackFolderCapture = ({ runId }: UntrackParams): void => {
  captures.delete(runId);
};

export const holdsFolderCapture = ({ sessionId, folderPath }: HoldsParams): boolean => {
  for (const capture of captures.values()) {
    if (capture.sessionId === sessionId && capture.folderPaths.includes(folderPath)) {
      return true;
    }
  }
  return false;
};
