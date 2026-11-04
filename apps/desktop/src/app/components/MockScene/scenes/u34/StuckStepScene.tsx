import { useEffect, useState } from 'react';
import type { Agent, AgentId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import {
  AGENT_BACKFILL_ID,
  AGENT_ROUNDING_ID,
  FLOW_AGENTS,
  FLOW_SESSION,
  FLOW_SESSION_ID,
} from '../flow-audit/fixtures';
import { FINISHED_AGENTS, FINISHED_SESSION } from '../flow-audit/finishedRun';
import { seedWorkflowRun, seedWorkflowRunFinished } from '../flow-audit/seeds';
import { SceneRunsSurface } from '../SceneRunsSurface';

const clock = sceneClock({ anchor: '2026-09-16T11:20:00.000Z' });

export type StuckStepState = 'not-finished' | 'blocked' | 'finished';

type Props = {
  readonly state: StuckStepState;
};

type PatchParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly id: AgentId;
  readonly patch: Partial<Agent>;
};

const patched = ({ agents, id, patch }: PatchParams): ReadonlyArray<Agent> =>
  agents.map((agent) => (agent.id === id ? { ...agent, ...patch } : agent));

const NOT_FINISHED: Partial<Agent> = {
  status: 'skipped',
  outputSummary: 'The agent stopped without finishing and without saying why.',
  completedAt: clock.iso({ at: '2026-09-16T10:30:00.000Z' }),
};

export const StuckStepScene = ({ state }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (state === 'finished') {
      seedWorkflowRunFinished();
      useAppStore.setState({
        sessionPhaseRuns: {
          [FLOW_SESSION_ID]: patched({
            agents: FINISHED_AGENTS,
            id: AGENT_ROUNDING_ID,
            patch: NOT_FINISHED,
          }),
        },
      });
    }
    if (state === 'not-finished') {
      seedWorkflowRun();
      useAppStore.setState({
        sessionPhaseRuns: {
          [FLOW_SESSION_ID]: patched({
            agents: FLOW_AGENTS,
            id: AGENT_ROUNDING_ID,
            patch: NOT_FINISHED,
          }),
        },
      });
    }
    if (state === 'blocked') {
      seedWorkflowRun();
      useAppStore.setState({
        sessionPhaseRuns: {
          [FLOW_SESSION_ID]: patched({
            agents: FLOW_AGENTS,
            id: AGENT_BACKFILL_ID,
            patch: {
              status: 'blocked',
              completedAt: clock.iso({ at: '2026-09-16T11:14:30.000Z' }),
            },
          }),
        },
        agentTurnState: {},
        sessionOpenQuestions: { [FLOW_SESSION_ID]: [] },
      });
    }
    setIsReady(true);
  }, [state]);

  if (!isReady) {
    return null;
  }
  return (
    <div className="flex h-screen min-h-0 flex-col bg-background text-foreground">
      <SceneRunsSurface session={state === 'finished' ? FINISHED_SESSION : FLOW_SESSION} />
    </div>
  );
};
