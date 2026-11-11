import {
  CHECK_STATE,
  NOTHING_CHANGED,
  READ_FAILED,
} from '../../../../store/slices/notifications/errorRecovery';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AgentId, ArtifactId, SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import { createLatestOnly } from '../../../../store/runtime/state-writes/latestOnly';
import { tauriDatabase } from '../../../../shared/lib/db';
import { artifactApprovalOf, type ArtifactApprovalView } from '../../chat/artifactApprovalOf';
import { AUTO_BRIDGE_EVENT, type AutoArtifactsChanged } from '../../bridge/autoBridgeProtocol';
import { tauriAutoBridgeBus } from '../../bridge/tauriAutoBridgeBus';
import { useAutoTreeViews } from '../../useAutoTreeViews';
import { approveAutoPlan } from '../approveAutoPlan';

type Params = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
};

export type AutoPlanApprovalModel = Readonly<{
  approval: ArtifactApprovalView;
  version: number;
  rootAgentId: AgentId;
  isBusy: boolean;
  isToldFailed: boolean;
  approve: () => Promise<void>;
  tellAuto: () => Promise<void>;
  askForChanges: () => void;
}>;

export const useAutoPlanApproval = ({
  sessionId,
  artifactId,
}: Params): AutoPlanApprovalModel | null => {
  const views = useAutoTreeViews({ sessionId });
  const sendTurn = useAppStore((state) => state.sendTurn);
  const navigate = useAppStore((state) => state.navigate);
  const reportError = useAppStore((state) => state.reportError);
  const loadAutoTrees = useAppStore((state) => state.loadAutoTrees);
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const [isBusy, setIsBusy] = useState(false);
  const [toldFailedRevision, setToldFailedRevision] = useState<number | null>(null);

  const found = useMemo(() => {
    for (const view of views) {
      const row = view.artifacts.find((candidate) => candidate.artifact.artifactId === artifactId);
      if (row !== undefined) {
        return { view, row };
      }
    }
    return null;
  }, [views, artifactId]);

  const rootAgentId = found?.view.tree.rootAgentId ?? null;
  const version = found?.row.revision ?? 0;
  const latest = useMemo(() => createLatestOnly(), []);

  useEffect(() => {
    latest.cancel({ key: artifactId });
  }, [artifactId, latest, version]);

  const onWritten = useCallback(async (): Promise<void> => {
    const payload: AutoArtifactsChanged = { sessionId };
    await Promise.all([
      loadAutoTrees({ sessionId }).catch((error: unknown) =>
        reportError({
          recovery: READ_FAILED,
          title: "Couldn't read the Auto agents",
          error,
          sessionId,
        }),
      ),
      tauriAutoBridgeBus
        .emit({ event: AUTO_BRIDGE_EVENT.artifactsChanged, payload })
        .catch((error: unknown) =>
          reportError({
            recovery: CHECK_STATE,
            title: "Couldn't tell the other windows about the plan",
            error,
            sessionId,
          }),
        ),
    ]);
  }, [loadAutoTrees, reportError, sessionId]);

  const approve = useCallback(async (): Promise<void> => {
    if (rootAgentId === null || isBusy) {
      return;
    }
    setIsBusy(true);
    const claimed = latest.claim({ key: artifactId });
    try {
      const result = await approveAutoPlan({
        db: tauriDatabase,
        sessionId,
        rootAgentId,
        artifactId,
        expectedRevision: version,
        send: async (params) => {
          await sendTurn({ ...params });
        },
        onWritten,
      });
      if (!claimed.isCurrent()) {
        return;
      }
      if (result.kind === 'refused') {
        await reportError({
          recovery: NOTHING_CHANGED,
          title: "Couldn't approve the plan",
          error: new Error(result.message),
          sessionId,
        });
      }
      if (result.kind === 'told_failed') {
        setToldFailedRevision(result.revision);
        await reportError({
          recovery: CHECK_STATE,
          title: "The plan is approved, but Auto wasn't told",
          error: result.error,
          sessionId,
        });
      }
      if (result.kind === 'approved' || result.kind === 'already_approved') {
        closeDrawer();
      }
    } catch (error) {
      if (claimed.isCurrent()) {
        await reportError({
          recovery: CHECK_STATE,
          title: "Couldn't approve the plan",
          error,
          sessionId,
        });
      }
    } finally {
      await loadAutoTrees({ sessionId }).catch((error: unknown) =>
        reportError({
          recovery: READ_FAILED,
          title: "Couldn't read the Auto agents",
          error,
          sessionId,
        }),
      );
      setIsBusy(false);
    }
  }, [
    artifactId,
    closeDrawer,
    isBusy,
    latest,
    loadAutoTrees,
    onWritten,
    reportError,
    rootAgentId,
    sendTurn,
    sessionId,
    version,
  ]);

  const tellAuto = useCallback(async (): Promise<void> => {
    if (rootAgentId === null || toldFailedRevision === null || isBusy) {
      return;
    }
    setIsBusy(true);
    try {
      await sendTurn({
        sessionId,
        agentId: rootAgentId,
        content: `Approved plan v${toldFailedRevision}.`,
      });
      setToldFailedRevision(null);
      closeDrawer();
    } catch (error) {
      await reportError({ recovery: CHECK_STATE, title: "Couldn't tell Auto", error, sessionId });
    } finally {
      setIsBusy(false);
    }
  }, [closeDrawer, isBusy, reportError, rootAgentId, sendTurn, sessionId, toldFailedRevision]);

  const askForChanges = useCallback(() => {
    if (rootAgentId === null) {
      return;
    }
    closeDrawer();
    navigate({ to: agentPlace({ sessionId, agentId: rootAgentId }) });
  }, [closeDrawer, navigate, rootAgentId, sessionId]);

  if (found === null || rootAgentId === null) {
    return null;
  }
  const approval = artifactApprovalOf({ row: found.row, level: found.view.level });
  if (approval === null) {
    return null;
  }
  return {
    approval,
    version,
    rootAgentId,
    isBusy,
    isToldFailed: toldFailedRevision !== null,
    approve,
    tellAuto,
    askForChanges,
  };
};
