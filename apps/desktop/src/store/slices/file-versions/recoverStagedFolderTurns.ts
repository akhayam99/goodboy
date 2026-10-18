import { brandId, type ProviderRunId, type SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { fileVersionsFolderListStaged } from '../../../features/file-versions/fileVersions';
import { listLiveRunIds } from '../../../features/chat/turn';
import { finalizeFolderCapture } from './finalizeFolderCapture';
import type { GetFn, SetFn } from './types';

type FailureInfo = Readonly<{
  sessionId: SessionId;
  runId: string;
  message: string;
}>;

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  nowMs: number;
  onFailure: (info: FailureInfo) => Promise<void>;
}>;

const YOUNG_RUN_MS = 60_000;

export const recoverStagedFolderTurns = async ({
  set,
  get,
  nowMs,
  onFailure,
}: Params): Promise<void> => {
  const staged = await fileVersionsFolderListStaged();
  if (staged.length === 0) {
    return;
  }
  const live = await listLiveRunIds();
  for (const run of staged) {
    if (live.has(run.runId) || nowMs - run.startedAtMs < YOUNG_RUN_MS) {
      continue;
    }
    try {
      await finalizeFolderCapture({
        set,
        get,
        sessionId: run.sessionId,
        runId: brandId<ProviderRunId>({ value: run.runId }),
        folderPaths: [run.folderPath],
      });
    } catch (error) {
      await onFailure({ sessionId: run.sessionId, runId: run.runId, message: formatError(error) });
    }
  }
};
