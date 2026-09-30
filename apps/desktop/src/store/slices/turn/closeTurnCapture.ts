import { clearMaterializationBatch } from '../project-mounts/materializationGate';
import { flushTurnEvents } from '../transcripts/buffer';
import { finalizeTurnFileVersionCapture } from '../file-versions/captureTurnFileVersions';
import type { GetFn } from './types';
import type { TurnContext } from './turnContext';

type Params = Readonly<{
  get: GetFn;
  ctx: TurnContext;
}>;

export const closeTurnCapture = async ({ get, ctx }: Params) => {
  const { sessionId } = ctx.input;
  const { workingDir, runId, notifySnapshotFailure, turnFileVersionCapture } = ctx;
  flushTurnEvents();
  if (turnFileVersionCapture != null) {
    await finalizeTurnFileVersionCapture({
      sessionId,
      sessionDir: workingDir,
      runId,
      manifest: turnFileVersionCapture.manifest,
      providerRunId: runId,
      onFailure: notifySnapshotFailure,
    });
    if (get().sessionFileVersions[sessionId] !== undefined) {
      await get().loadSessionFileVersions({ sessionId, force: true });
    }
  }
  clearMaterializationBatch({ sessionId, batchId: runId });
};
