import { useEffect, useState } from 'react';
import { brandId } from '@goodboy/types';
import type { Agent, AgentId, IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';
import { ChatView } from '../../../../../features/chat/components/ChatView';
import { useAppStore } from '../../../../../store';
import { NOW, SESSION, seedActivityRunScene } from '../activityRunSeed';

const AGENT_ID = brandId<AgentId>({ value: 'mock-long-agent' });
const TURN_COUNT = 50;
const MINUTE_MS = 60_000;
const FIRST_TURN_MS = Date.parse('2026-09-07T08:00:00.000Z');

const AGENT: Agent = {
  id: AGENT_ID,
  sessionId: SESSION.id,
  name: 'Export speed up',
  kind: 'implementer',
  status: 'completed',
  ordinal: 1,
  lastFinishedAt: NOW,
  lastViewedAt: NOW,
};

const SENTENCE =
  'The export walks every ledger row twice: once to total it and once to format it, so the cost doubles with the account size. ';

type TurnParams = {
  readonly turn: number;
};

const answerOf = ({ turn }: TurnParams): string =>
  `Step ${turn + 1}. ${SENTENCE.repeat(1 + (turn % 7) * 2)}`;

const questionOf = ({ turn }: TurnParams): string =>
  turn % 4 === 0
    ? `Check the next batch.\nThen report the timing for chunk ${turn}.`
    : `Next: chunk ${turn}.`;

const transcriptOf = (): ReadonlyArray<TurnEvent> =>
  Array.from({ length: TURN_COUNT }, (_, turn) => {
    const runId = brandId<ProviderRunId>({ value: `mock-long-run-${turn}` });
    const at = brandId<IsoDateTime>({
      value: new Date(FIRST_TURN_MS + turn * MINUTE_MS).toISOString(),
    });
    const base = [
      { kind: 'user_text' as const, runId, text: questionOf({ turn }), at },
      { kind: 'assistant_text' as const, runId, delta: answerOf({ turn }), at },
    ];
    return turn % 5 === 0
      ? [
          ...base,
          {
            kind: 'decision_note' as const,
            runId,
            message: `Checked chunk ${turn} in notify-relay.`,
            at,
          },
        ]
      : base;
  }).flat();

export const TranscriptLongScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedActivityRunScene();
    useAppStore.setState({
      sessionPhaseRuns: { [SESSION.id]: [AGENT] },
      selectedAgentId: { [SESSION.id]: AGENT_ID },
      agentPane: { [SESSION.id]: 'transcript' },
      transcripts: { [AGENT_ID]: transcriptOf() },
      loadAgentTranscript: async () => undefined,
      sessionOpenQuestions: { [SESSION.id]: [] },
      sessionAnsweredQuestions: { [SESSION.id]: [] },
      sessionEvents: { [SESSION.id]: [] },
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-background">
      <ChatView session={SESSION} />
    </div>
  );
};
