import { useAppStore } from '../../../store/store';
import { tauriDatabase } from '../../../shared/lib/db';
import { AUTO_BRIDGE_EVENT } from '../../auto/bridge/autoBridgeProtocol';
import { tauriAutoBridgeBus } from '../../auto/bridge/tauriAutoBridgeBus';
import { approveAutoPlan } from '../../auto/plan/approveAutoPlan';
import type { DecidePorts } from './handlerTypes';

export const decidePorts: DecidePorts = {
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
          await useAppStore
            .getState()
            .sendTurn({ sessionId: targetId, agentId, content, focusArtifactId });
        },
        onWritten: async () => {
          await refreshTrees();
          await tauriAutoBridgeBus.emit({
            event: AUTO_BRIDGE_EVENT.artifactsChanged,
            payload: { sessionId },
          });
        },
      });
    } finally {
      await refreshTrees().catch((error: unknown) =>
        console.error('[bridge] approvePlan reload failed', error),
      );
    }
  },
};
