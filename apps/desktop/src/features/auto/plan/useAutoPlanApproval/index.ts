import { useCallback, useMemo, useState } from 'react';
import type { AgentId, ArtifactId, SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import { tauriDatabase } from '../../../../shared/lib/db';
import { artifactApprovalOf, type ArtifactApprovalView } from '../../chat/artifactApprovalOf';
import { autoPlanOutlineOf, type AutoPlanOutline } from '../../chat/autoPlanOutlineOf';
import { useAutoTreeViews } from '../../useAutoTreeViews';
import { approveAutoPlan } from '../approveAutoPlan';

type Params = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
};

export type AutoPlanApprovalModel = Readonly<{
  approval: ArtifactApprovalView;
  version: number;
  outline: AutoPlanOutline | null;
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

  const approve = useCallback(async (): Promise<void> => {
    if (rootAgentId === null || isBusy) {
      return;
    }
    setIsBusy(true);
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
      });
      if (result.kind === 'refused') {
        await reportError({
          title: "Couldn't approve the plan",
          error: new Error(result.message),
          sessionId,
        });
      }
      if (result.kind === 'told_failed') {
        setToldFailedRevision(result.revision);
        await reportError({
          title: 'The plan is approved, but Auto was not told',
          error: result.error,
          sessionId,
        });
      }
      if (result.kind === 'approved' || result.kind === 'already_approved') {
        closeDrawer();
      }
    } catch (error) {
      await reportError({ title: "Couldn't approve the plan", error, sessionId });
    } finally {
      await loadAutoTrees({ sessionId }).catch((error: unknown) =>
        reportError({ title: "Couldn't read the Auto agents", error, sessionId }),
      );
      setIsBusy(false);
    }
  }, [
    artifactId,
    closeDrawer,
    isBusy,
    loadAutoTrees,
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
      await reportError({ title: "Couldn't tell Auto", error, sessionId });
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
  const approval = artifactApprovalOf({ row: found.row });
  if (approval === null) {
    return null;
  }
  return {
    approval,
    version,
    outline: autoPlanOutlineOf({ sourceText: found.row.sourceText }),
    rootAgentId,
    isBusy,
    isToldFailed: toldFailedRevision !== null,
    approve,
    tellAuto,
    askForChanges,
  };
};
