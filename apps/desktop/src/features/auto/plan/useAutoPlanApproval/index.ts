import {
  CHECK_STATE,
  NOTHING_CHANGED,
  READ_FAILED,
} from '../../../../store/slices/notifications/errorRecovery';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  brandId,
  type AgentId,
  type ArtifactId,
  type AutoDelegationId,
  type SessionId,
} from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import { keepAutoPlanBase } from '../../../../store/runtime/auto/close/keepAutoPlanBase';
import { createLatestOnly } from '../../../../store/runtime/state-writes/latestOnly';
import { tauriDatabase } from '../../../../shared/lib/db';
import type { ArtifactApprovalView } from '../../chat/artifactApprovalOf';
import { planApprovalInViewOf } from '../../chat/planApprovalInViewOf';
import { dockPlanOf } from '../../dockPlanOf';
import { planBlockedReasonOf } from '../../planBlockedReasonOf';
import { planLineOf } from '../../planLineOf';
import { AUTO_BRIDGE_EVENT, type AutoArtifactsChanged } from '../../bridge/autoBridgeProtocol';
import { tauriAutoBridgeBus } from '../../bridge/tauriAutoBridgeBus';
import { useAutoTreeViews } from '../../useAutoTreeViews';
import { approveAutoPlan } from '../approveAutoPlan';
import { dropAutoPlan } from '../dropAutoPlan';

type Params = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
};

export type AutoPlanApprovalModel = Readonly<{
  approval: ArtifactApprovalView;
  version: number;
  shownVersion: number;
  blockedReason: string | null;
  rootAgentId: AgentId;
  isBusy: boolean;
  isToldFailed: boolean;
  approve: () => Promise<void>;
  tellAuto: () => Promise<void>;
  askForChanges: () => void;
  drop: () => Promise<void>;
  keep: (params: KeepParams) => Promise<void>;
}>;

type KeepParams = {
  readonly delegationId: string;
};

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
          title: "Couldn't read the runs",
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
          title: "The plan is approved, but the Lead wasn't told",
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
          title: "Couldn't read the runs",
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
      await reportError({
        recovery: CHECK_STATE,
        title: "Couldn't send the approval to the Lead",
        error,
        sessionId,
      });
    } finally {
      setIsBusy(false);
    }
  }, [closeDrawer, isBusy, reportError, rootAgentId, sendTurn, sessionId, toldFailedRevision]);

  const treeId = found?.view.tree.id ?? null;

  const drop = useCallback(async (): Promise<void> => {
    if (treeId === null || isBusy) {
      return;
    }
    setIsBusy(true);
    try {
      await dropAutoPlan({ db: tauriDatabase, treeId, artifactId });
      await onWritten();
    } catch (error) {
      await reportError({
        recovery: NOTHING_CHANGED,
        title: "Couldn't drop the plan",
        error,
        sessionId,
      });
    } finally {
      setIsBusy(false);
    }
  }, [artifactId, isBusy, onWritten, reportError, sessionId, treeId]);

  const keep = useCallback(
    async ({ delegationId }: KeepParams): Promise<void> => {
      if (treeId === null || isBusy) {
        return;
      }
      setIsBusy(true);
      try {
        const outcome = await keepAutoPlanBase({
          db: tauriDatabase,
          treeId,
          delegationId: brandId<AutoDelegationId>({ value: delegationId }),
          artifactId,
          revision: version,
          nowMs: Date.now(),
        });
        if (outcome === 'refused') {
          throw new Error(`Plan v${version} is no longer the version that waits for you.`);
        }
        await onWritten();
      } catch (error) {
        await reportError({
          recovery: NOTHING_CHANGED,
          title: `Couldn't keep plan v${version}`,
          error,
          sessionId,
        });
      } finally {
        setIsBusy(false);
      }
    },
    [artifactId, isBusy, onWritten, reportError, sessionId, treeId, version],
  );

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
  const approval = planApprovalInViewOf({ view: found.view, row: found.row });
  if (approval === null) {
    return null;
  }
  const dock = dockPlanOf({ view: found.view });
  const isDocked = dock?.row.artifact.artifactId === artifactId;
  const shownVersion =
    planLineOf({ view: found.view }).find((entry) => entry.row.artifact.artifactId === artifactId)
      ?.version ?? version;
  return {
    approval,
    version,
    shownVersion,
    blockedReason: dock !== null && isDocked ? planBlockedReasonOf({ plan: dock }) : null,
    rootAgentId,
    isBusy,
    isToldFailed: toldFailedRevision !== null,
    approve,
    tellAuto,
    askForChanges,
    drop,
    keep,
  };
};
