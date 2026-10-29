import { useEffect, useState } from 'react';
import { brandId, type ProviderRunId, type TurnEvent } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import {
  AGENT_BACKFILL_ID,
  FLOW_AGENTS,
  FLOW_SESSION,
  FLOW_SESSION_ID,
} from '../flow-audit/fixtures';
import { seedWorkflowRun } from '../flow-audit/seeds';
import { SceneRunsSurface } from '../SceneRunsSurface';

const clock = sceneClock({ anchor: '2026-09-16T11:20:00.000Z' });

const RUN_ID = brandId<ProviderRunId>({ value: 'mock-step-ended-provider-run' });

const CLOSING: TurnEvent = {
  kind: 'assistant_text',
  runId: RUN_ID,
  delta:
    'Recorded the attempts on each delivery in notify-relay and ran the suite once. The retry path still needs a second look.',
  at: clock.iso({ at: '2026-09-16T11:14:00.000Z' }),
};

export const StepEndedScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedWorkflowRun();
    useAppStore.setState({
      sessionPhaseRuns: {
        [FLOW_SESSION_ID]: FLOW_AGENTS.map((agent) =>
          agent.id === AGENT_BACKFILL_ID
            ? {
                ...agent,
                status: 'blocked',
                completedAt: clock.iso({ at: '2026-09-16T11:14:30.000Z' }),
              }
            : agent,
        ),
      },
      silentlyEndedSteps: { [AGENT_BACKFILL_ID]: clock.iso({ at: '2026-09-16T11:14:30.000Z' }) },
      agentTurnState: {},
      transcripts: { [AGENT_BACKFILL_ID]: [CLOSING] },
      sessionOpenQuestions: { [FLOW_SESSION_ID]: [] },
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }
  return (
    <div className="flex h-screen min-h-0 flex-col bg-background text-foreground">
      <SceneRunsSurface session={FLOW_SESSION} />
    </div>
  );
};
