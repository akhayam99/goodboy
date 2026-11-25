import { useEffect, useState } from 'react';
import { brandId, type AgentId, type TelemetryRecordId } from '@goodboy/types';
import { studioRailFoldKey } from '@goodboy/ui';
import { useAppStore } from '../../../../../../store';
import { AUTO_SESSION, IMPLEMENTER_ID } from '../../u24/autoSceneSeed';
import { RunPageScene } from '../run-page/RunPageScene';
import { AGENT_COSTS_USD, agentTreeSceneOf, runIdOf } from './agentTreeSceneOf';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly isFolded?: boolean;
  readonly shownAgentId?: AgentId;
};

const RAIL_SURFACE = 'run-agents';

type FoldParams = {
  readonly isFolded: boolean;
};

const foldRail = ({ isFolded }: FoldParams): boolean => {
  try {
    localStorage.setItem(studioRailFoldKey({ surface: RAIL_SURFACE }), isFolded ? '1' : '0');
  } catch {
    return isFolded;
  }
  return isFolded;
};

export const AgentTreeScene = ({
  theme,
  isFolded = false,
  shownAgentId = IMPLEMENTER_ID,
}: Props) => {
  const [isReady] = useState(() => foldRail({ isFolded }));
  useEffect(() => {
    useAppStore.setState({
      sessionTelemetry: {
        [AUTO_SESSION.id]: Object.entries(AGENT_COSTS_USD).map(([agentId, cost]) => ({
          id: brandId<TelemetryRecordId>({ value: `mock-tree-telemetry-${agentId}` }),
          runId: runIdOf({ agentId: brandId<AgentId>({ value: agentId }) }),
          sessionId: AUTO_SESSION.id,
          kind: 'turn',
          provider: 'anthropic',
          model: 'claude-sonnet-5',
          recordedAt: AUTO_SESSION.updatedAt,
          inputTokens: 12_000,
          outputTokens: 2_400,
          estimatedCostUsd: cost,
        })),
      },
    });
  }, []);
  return (
    <RunPageScene
      key={String(isReady)}
      state="working"
      theme={theme}
      isLead
      extend={agentTreeSceneOf}
      shownAgentId={shownAgentId}
    />
  );
};
