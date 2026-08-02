import type { ProviderRunId, SessionId } from '@goodboy/types';
import {
  fileVersionsFinalizeSnapshot,
  fileVersionsListStagedSnapshots,
} from '../../../features/file-versions/fileVersions';
import { formatError } from '../../../shared/lib/errors';
import { persistFinalizedFileVersions } from './persistFinalizedFileVersions';

type FailureInfo = Readonly<{
  sessionId: SessionId;
  runId: string;
  message: string;
}>;

type Params = Readonly<{
  onFailure: (info: FailureInfo) => Promise<void>;
}>;

export const recoverStagedFileVersions = async ({ onFailure }: Params): Promise<void> => {
  const staged = await fileVersionsListStagedSnapshots();
  const skippedRuns = staged?.skipped ?? [];
  const pendingRuns = staged?.runs ?? [];
  for (const skipped of skippedRuns) {
    await onFailure({
      sessionId: skipped.sessionId,
      runId: skipped.runId,
      message: `staged snapshot skipped (${skipped.reason})`,
    });
  }
  for (const run of pendingRuns) {
    try {
      const finalized = await fileVersionsFinalizeSnapshot({
        sessionDir: run.sessionDir,
        sessionId: run.sessionId,
        runId: run.runId,
        manifest: run.manifest,
      });
      await persistFinalizedFileVersions({
        sessionId: run.sessionId,
        snapshotSource: 'agent_turn',
        providerRunId: run.runId as ProviderRunId,
        kept: finalized.kept,
        onFailure: async (error) => {
          await onFailure({
            sessionId: run.sessionId,
            runId: run.runId,
            message: formatError(error),
          });
        },
      });
    } catch (error) {
      await onFailure({
        sessionId: run.sessionId,
        runId: run.runId,
        message: formatError(error),
      });
    }
  }
};
