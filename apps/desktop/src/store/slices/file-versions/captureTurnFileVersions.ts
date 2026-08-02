import type { ProviderRunId, SessionId } from '@goodboy/types';
import {
  fileVersionsBeginSnapshot,
  fileVersionsFinalizeSnapshot,
  type SnapshotManifestEntry,
} from '../../../features/file-versions/fileVersions';
import { formatError } from '../../../shared/lib/errors';
import { persistFinalizedFileVersions } from './persistFinalizedFileVersions';

type SnapshotFailure = Readonly<{
  stage: 'begin' | 'finalize' | 'persist';
  message: string;
}>;

type BeginParams = Readonly<{
  sessionId: SessionId;
  sessionDir: string;
  runId: ProviderRunId;
  onFailure: (failure: SnapshotFailure) => Promise<void>;
}>;

type BeginResult = Readonly<{
  manifest: ReadonlyArray<SnapshotManifestEntry>;
}>;

export const beginTurnFileVersionCapture = async ({
  sessionId,
  sessionDir,
  runId,
  onFailure,
}: BeginParams): Promise<BeginResult | null> => {
  try {
    const begin = await fileVersionsBeginSnapshot({
      sessionDir,
      sessionId,
      runId,
    });
    return { manifest: begin.manifest };
  } catch (error) {
    await onFailure({ stage: 'begin', message: formatError(error) });
    return null;
  }
};

type FinalizeParams = Readonly<{
  sessionId: SessionId;
  sessionDir: string;
  runId: ProviderRunId;
  manifest: ReadonlyArray<SnapshotManifestEntry>;
  providerRunId: ProviderRunId;
  onFailure: (failure: SnapshotFailure) => Promise<void>;
}>;

export const finalizeTurnFileVersionCapture = async ({
  sessionId,
  sessionDir,
  runId,
  manifest,
  providerRunId,
  onFailure,
}: FinalizeParams): Promise<void> => {
  try {
    const finalized = await fileVersionsFinalizeSnapshot({
      sessionDir,
      sessionId,
      runId,
      manifest,
    });
    await persistFinalizedFileVersions({
      sessionId,
      snapshotSource: 'agent_turn',
      providerRunId,
      kept: finalized.kept,
      onFailure: async (error) => {
        await onFailure({ stage: 'persist', message: formatError(error) });
      },
    });
  } catch (error) {
    await onFailure({ stage: 'finalize', message: formatError(error) });
  }
};
