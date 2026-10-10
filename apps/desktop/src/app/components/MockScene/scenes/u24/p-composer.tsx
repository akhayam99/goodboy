import { useEffect, useState, type ComponentType } from 'react';
import type { Agent, AgentId, ProviderRunId, TurnState } from '@goodboy/types';
import { Notice } from '@goodboy/ui';
import { AgentDetailPane } from '../../../../../features/session/components/AgentDetailPane';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { ACTIVITY_QUESTION_SESSION, seedActivityQuestionScene } from '../activityQuestionSeed';
import { sceneParam } from '../audit/sceneParams';
import { ShellFrame, seedShellChrome } from '../shellChrome';

const clock = sceneClock({ anchor: '2026-10-10T10:30:00.000Z' });

const NOW = clock.iso({ at: '2026-10-10T10:30:00.000Z' });
const RUN_ID = 'mock-u24-composer-run' as ProviderRunId;
const TURN_COUNT = 40;

const SESSION = ACTIVITY_QUESTION_SESSION;

type Lead = 'stopped' | 'next' | 'firstlap' | 'all';

const LEADS: ReadonlyArray<Lead> = ['stopped', 'next', 'firstlap', 'all'];

const leadFromAddress = (): Lead => {
  const value = sceneParam({ key: 'lead' });
  return LEADS.find((lead) => lead === value) ?? 'all';
};

const transcriptOf = () =>
  Array.from({ length: TURN_COUNT }, (_, index) =>
    index % 2 === 0
      ? {
          kind: 'user_text' as const,
          runId: RUN_ID,
          text: `Turn ${index / 2 + 1}: check the settlement total for batch ${100 + index}.`,
          at: NOW,
        }
      : {
          kind: 'assistant_text' as const,
          runId: RUN_ID,
          delta: `Batch ${100 + index - 1} rounds once at the settlement boundary and the fee lines stay exact.`,
          at: NOW,
        },
  );

type SceneParams = {
  readonly lead: Lead;
};

const CHILD_ID = 'mock-u24-composer-agent-fee-lines' as AgentId;

const seed = ({ lead }: SceneParams): AgentId => {
  seedActivityQuestionScene();
  const agents: ReadonlyArray<Agent> = useAppStore.getState().sessionPhaseRuns[SESSION.id] ?? [];
  const first = agents[0] as Agent;
  const isStopped = lead === 'stopped' || lead === 'all';
  const isNext = lead === 'next' || lead === 'all';
  const root: Agent = { ...first, status: isNext ? 'blocked' : 'completed' };
  const child: Agent = {
    id: CHILD_ID,
    sessionId: SESSION.id,
    ordinal: 1,
    name: 'Keep the fee lines exact',
    kind: 'implementer',
    status: 'stopped',
    parentAgentId: root.id,
    startedAt: NOW,
  };
  const shown = isStopped ? child : root;
  const idle: TurnState = { kind: 'idle', lastActivityAt: NOW };
  seedShellChrome({
    session: SESSION,
    siblings: [],
    branches: { [SESSION.id]: 'nw/fix-settlement-rounding' },
    telemetryAt: NOW,
    lens: null,
  });
  useAppStore.setState({
    sessionPhaseRuns: { [SESSION.id]: isStopped ? [root, child] : [root] },
    sessionOpenQuestions: { [SESSION.id]: [] },
    selectedAgentId: { [SESSION.id]: shown.id },
    agentPane: { [SESSION.id]: 'transcript' },
    agentTab: {},
    agentTurnState: { [shown.id]: idle },
    transcripts: { [shown.id]: transcriptOf() },
    messages: { [SESSION.id]: [] },
    loadAgentTranscript: async () => undefined,
  });
  return shown.id;
};

const AgentLeadScene = () => {
  const [agentId, setAgentId] = useState<AgentId | null>(null);
  const lead = leadFromAddress();

  useEffect(() => {
    setAgentId(seed({ lead }));
  }, [lead]);

  const agent = useAppStore((state) =>
    agentId === null
      ? null
      : (state.sessionPhaseRuns[SESSION.id]?.find((row) => row.id === agentId) ?? null),
  );

  if (agent === null) {
    return null;
  }

  return (
    <ShellFrame
      session={SESSION}
      main={
        <AgentDetailPane
          session={SESSION}
          agent={agent}
          isChatActive
          onBack={() => undefined}
          context={
            lead === 'firstlap' || lead === 'all' ? (
              <Notice
                tone="info"
                placement="inline"
                title="First lap"
                body="This agent started from the ledger-core rounding fix in Harborline."
              />
            ) : undefined
          }
        />
      }
    />
  );
};

export const U24_P_COMPOSER_SCENES = {
  agentlead: AgentLeadScene,
} satisfies Readonly<Record<string, ComponentType>>;
