import { useEffect, useState } from 'react';
import type { InvokeArgs } from '@tauri-apps/api/core';
import { mockIPC } from '@tauri-apps/api/mocks';
import { ImpactStudio } from '../../../../features/impact/components/ImpactStudio';
import { useAppStore } from '../../../../store';
import { sceneParam } from './audit/sceneParams';
import { useSceneClicks } from './audit/useSceneClicks';
import {
  IMPACT_DELETED_WORKSPACE_ID,
  impactDeletedDormantSpend,
  impactDeletedLiveSessions,
  impactDeletedLiveTelemetry,
  impactDeletedSelect,
} from './impactDeletedSeed';
import { mockWorkspace, seedStudioChrome } from './shellChrome';
import { StudioFrame } from './StudioFrame';

const WORKSPACE_NAME = 'Harborline';

const TAB = sceneParam({ key: 'tab' }) ?? 'Overview';

const CLICKS: ReadonlyArray<string> = ['All time', TAB];

const noop = async (): Promise<void> => undefined;

type PayloadParams = {
  readonly payload: InvokeArgs | undefined;
};

const payloadSql = ({ payload }: PayloadParams): string => {
  if (payload === undefined || Array.isArray(payload)) {
    return '';
  }
  if (payload instanceof ArrayBuffer || payload instanceof Uint8Array) {
    return '';
  }
  const sql = payload.sql;
  return typeof sql === 'string' ? sql : '';
};

const seedScene = (): void => {
  mockIPC((cmd, payload) => {
    if (cmd === 'db_select') {
      return impactDeletedSelect({ sql: payloadSql({ payload }) });
    }
    return null;
  });
  seedStudioChrome();
  const sessions = impactDeletedLiveSessions();
  useAppStore.setState({
    workspaces: [mockWorkspace({ id: IMPACT_DELETED_WORKSPACE_ID, name: WORKSPACE_NAME })],
    sessions,
    currentSessionId: sessions[0]?.id ?? null,
    currentWorkspaceId: IMPACT_DELETED_WORKSPACE_ID,
    sessionTelemetry: impactDeletedLiveTelemetry(),
    dormantSpend: {
      workspaceId: IMPACT_DELETED_WORKSPACE_ID,
      entries: impactDeletedDormantSpend(),
    },
    providerSpendBreakdown: [
      { provider: 'anthropic', spentUsd: 0 },
      { provider: 'codex', spentUsd: 0 },
      { provider: 'cursor', spentUsd: 0 },
    ],
    budgetRules: [],
    budgetAlerts: [],
    loadBudgetRules: noop,
    loadBudgetAlerts: noop,
    loadSessionTelemetry: noop,
    loadSessionBudget: noop,
    refreshDormantPullRequests: async () => 0,
    navigate: () => undefined,
  });
};

export const ImpactDeletedScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedScene();
    setIsReady(true);
  }, []);

  useSceneClicks({
    isReady,
    labels: CLICKS,
    selector: '[role="tab"]',
    match: 'prefix',
    intervalMs: 250,
  });

  if (!isReady) {
    return null;
  }

  return (
    <StudioFrame
      target={{ place: 'impact', tool: null }}
      main={
        <ImpactStudio
          workspaceId={IMPACT_DELETED_WORKSPACE_ID}
          workspaceName={WORKSPACE_NAME}
          onClose={() => undefined}
        />
      }
    />
  );
};
