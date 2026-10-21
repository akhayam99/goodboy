import { useEffect, useState } from 'react';
import { DrawerColumn } from '@goodboy/ui';
import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type TurnEvent,
} from '@goodboy/types';
import { MOVE_TO_AUTO_EVENT } from '../../../../../features/auto/adopt/moveToAutoEvent';
import { AutoReleaseContext } from '../../../../../features/auto/autoReleaseContext';
import { aDelegation, aTree } from '../../../../../features/auto/testing/autoViewFixtures';
import { AgentDetailPane } from '../../../../../features/session/components/AgentDetailPane';
import { useAppStore } from '../../../../../store';
import type { AutoTreeView } from '../../../../../store/slices/auto-view/state';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/selectDrawerSizing';
import { sceneClock } from '../../sceneClock';
import { seedActivityRunScene } from '../activityRunSeed';
import { AUTO_ROOT_ID, AUTO_SESSION } from './autoSceneSeed';

const clock = sceneClock({ anchor: '2026-10-14T09:30:00.000Z' });

const SOURCE_ID = brandId<AgentId>({ value: 'mock-move-implementer' });
const RUN = brandId<ProviderRunId>({ value: 'mock-move-run-1' });

type AtParams = {
  readonly time: string;
};

const at = ({ time }: AtParams): IsoDateTime => clock.iso({ at: `2026-10-14T${time}.000Z` });

const GOAL = 'Cap the credit retries at three attempts in payments-api and add a test for the cap.';
const REPLY =
  'The cap is in postCredit as MAX_RETRY_ATTEMPTS, read from config.ts. Two tests cover the third and the fourth attempt. Nothing else changed.';

const EVENTS: ReadonlyArray<TurnEvent> = [
  { kind: 'user_text', runId: RUN, text: GOAL, at: at({ time: '09:12:00' }) },
  { kind: 'assistant_text', runId: RUN, delta: REPLY, at: at({ time: '09:14:10' }) },
];

export type AutoMoveState = 'panel' | 'moved';

type Props = {
  readonly state: AutoMoveState;
};

const SOURCE_AGENT: Agent = {
  id: SOURCE_ID,
  sessionId: AUTO_SESSION.id,
  ordinal: 1,
  name: 'Implementer',
  status: 'completed',
  kind: 'implementer',
  startedAt: at({ time: '09:12:00' }),
  completedAt: at({ time: '09:14:10' }),
  lastFinishedAt: at({ time: '09:14:10' }),
  lastViewedAt: at({ time: '09:20:00' }),
};

const AUTO_AGENT: Agent = {
  id: AUTO_ROOT_ID,
  sessionId: AUTO_SESSION.id,
  ordinal: 2,
  name: 'Auto',
  status: 'pending',
  kind: 'auto',
  startedAt: at({ time: '09:21:00' }),
};

const movedViewOf = (): AutoTreeView => ({
  tree: { ...aTree({ phase: 'merging', capUsd: 5 }), rootAgentId: AUTO_ROOT_ID },
  delegations: [
    {
      ...aDelegation({
        key: 'move-implementer',
        role: 'implementer',
        state: 'settled',
        outcome: 'completed',
        settledAt: clock.ms({ at: '2026-10-14T09:21:00.000Z' }),
      }),
      childAgentId: SOURCE_ID,
      isAdopted: true,
    },
  ],
  artifacts: [],
  budget: null,
  pendingRefusal: null,
  deliveredResults: [],
  rootAsk: null,
});

export const AutoMoveScene = ({ state }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const sizing = useAppStore(selectDrawerSizing);

  useEffect(() => {
    seedActivityRunScene();
    useAppStore.setState({
      sessionPhaseRuns: {
        [AUTO_SESSION.id]: state === 'moved' ? [SOURCE_AGENT, AUTO_AGENT] : [SOURCE_AGENT],
      },
      autoTreeViews: { [AUTO_SESSION.id]: state === 'moved' ? [movedViewOf()] : [] },
      loadAutoTrees: async () => undefined,
      selectedAgentId: { [AUTO_SESSION.id]: SOURCE_ID },
      agentPane: { [AUTO_SESSION.id]: 'transcript' },
      agentTurnState: { [SOURCE_ID]: { kind: 'idle', lastActivityAt: at({ time: '09:14:10' }) } },
      transcripts: { [SOURCE_ID]: EVENTS },
      loadAgentTranscript: async () => undefined,
      sessionOpenQuestions: { [AUTO_SESSION.id]: [] },
      sessionAnsweredQuestions: { [AUTO_SESSION.id]: [] },
      sessionArtifacts: { [AUTO_SESSION.id]: [] },
      sessionPlans: { [AUTO_SESSION.id]: [] },
      sessionEvents: { [AUTO_SESSION.id]: [] },
      drawer: null,
    });
    setIsReady(true);
  }, [state]);

  useEffect(() => {
    if (!isReady || state !== 'panel') {
      return;
    }
    window.dispatchEvent(new CustomEvent(MOVE_TO_AUTO_EVENT, { detail: { agentId: SOURCE_ID } }));
  }, [isReady, state]);

  if (!isReady) {
    return null;
  }
  return (
    <AutoReleaseContext.Provider value>
      <main className="flex h-screen bg-background text-foreground">
        <DrawerColumn
          main={
            <AgentDetailPane
              session={AUTO_SESSION}
              agent={SOURCE_AGENT}
              isChatActive
              onBack={() => undefined}
            />
          }
          drawer={null}
          sizing={sizing}
          ariaLabel="Side panel"
          resizeLabel="Resize side panel"
        />
      </main>
    </AutoReleaseContext.Provider>
  );
};
