import { useAppStore } from '../../../store/store';
import { tauriDatabase } from '../../../shared/lib/db';
import { AUTO_BRIDGE_EVENT } from '../../auto/bridge/autoBridgeProtocol';
import { tauriAutoBridgeBus } from '../../auto/bridge/tauriAutoBridgeBus';
import { currentAutoDrivePort } from '../../auto/autoDrivePort';
import { setAutoTreeCap } from '../../../store/runtime/auto/setAutoTreeCap';
import { approveAutoPlan } from '../../auto/plan/approveAutoPlan';
import { throwIfRefused } from '../../../store/slices/turn/refusal/throwIfRefused';
import type { DecidePorts } from './handlerTypes';

export const decidePorts: DecidePorts = {
  setTreeCap: async ({ sessionId, treeId, expectedCapUsd, capUsd }) => {
    const outcome = await setAutoTreeCap({
      db: tauriDatabase,
      treeId,
      expectedCapUsd,
      capUsd,
      nowMs: Date.now(),
      drive: currentAutoDrivePort(),
      onDriveError: console.error.bind(console, '[bridge] Lead did not restart after the cap'),
    });
    await useAppStore
      .getState()
      .loadAutoTrees({ sessionId })
      .catch((error: unknown) => console.error('[bridge] cap reload failed', error));
    return outcome;
  },
  approvePlan: async ({ sessionId, rootAgentId, artifactId, expectedRevision }) => {
    const refreshTrees = async (): Promise<void> => {
      await useAppStore.getState().loadAutoTrees({ sessionId });
    };
    try {
      return await approveAutoPlan({
        db: tauriDatabase,
        sessionId,
        rootAgentId,
        artifactId,
        expectedRevision,
        send: async ({ sessionId: targetId, agentId, content, focusArtifactId }) => {
          throwIfRefused({
            result: await useAppStore
              .getState()
              .sendTurn({ sessionId: targetId, agentId, content, focusArtifactId }),
          });
        },
        onWritten: async () => {
          await refreshTrees().catch((error: unknown) =>
            console.error('[bridge] approvePlan reload failed', error),
          );
          await tauriAutoBridgeBus
            .emit({ event: AUTO_BRIDGE_EVENT.artifactsChanged, payload: { sessionId } })
            .catch((error: unknown) => console.error('[bridge] approvePlan notify failed', error));
        },
      });
    } finally {
      await refreshTrees().catch((error: unknown) =>
        console.error('[bridge] approvePlan reload failed', error),
      );
    }
  },
};
