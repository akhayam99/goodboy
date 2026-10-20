import { useEffect, useState } from 'react';
import { brandId } from '@goodboy/types';
import type { Agent, AgentId, ProviderRunId, TurnEvent } from '@goodboy/types';
import { ChatView } from '../../../../../features/chat/components/ChatView';
import { liveTextRegistry } from '../../../../../features/chat/reveal/liveTextRegistry';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { NOW, SESSION, seedActivityRunScene } from '../activityRunSeed';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly landsAfterMs: number;
  readonly copies: number;
  readonly isLive: boolean;
  readonly isTable: boolean;
};

const AGENT_ID = brandId<AgentId>({ value: 'mock-reveal-agent' });
const EARLIER_RUN = brandId<ProviderRunId>({ value: 'mock-reveal-run-earlier' });
const LIVE_RUN = brandId<ProviderRunId>({ value: 'mock-reveal-run-live' });

const AGENT: Agent = {
  id: AGENT_ID,
  sessionId: SESSION.id,
  name: 'Review PR 309',
  kind: 'implementer',
  status: 'running',
  ordinal: 1,
  lastFinishedAt: NOW,
  lastViewedAt: NOW,
};

const ANSWER = [
  '## Why ledger-core rejects PR #309',
  '',
  'The migration in PR #309 adds a NOT NULL column to `ledger_entries` without a default. The schema check in ledger-core runs before every deploy, finds rows with no value and stops the release.',
  '',
  '- The check is `verify-schema`, step 3 of the Harborline deploy.',
  '- About 1.2M rows in production have no `settled_at` yet.',
  '- payments-api reads the column on every refund, so a half deploy would fail refunds.',
  '',
  'A safe order splits the change in three steps:',
  '',
  '```sql',
  'ALTER TABLE ledger_entries',
  '  ADD COLUMN settled_at timestamptz;',
  'UPDATE ledger_entries',
  '  SET settled_at = created_at;',
  'ALTER TABLE ledger_entries',
  '  ALTER COLUMN settled_at SET NOT NULL;',
  '```',
  '',
  '| Step | Time | Lock |',
  '|---|---|---|',
  '| Add the column | 40 ms | Brief |',
  '| Backfill in batches | 6 min | None |',
  '| Set NOT NULL | 2 s | Full scan |',
  '',
  'I would ship the column and the backfill in PR #309, and the NOT NULL in a follow-up once the backfill has run. Want me to open that follow-up on payments-api?',
].join('\n');

const TABLE_ANSWER = [
  'Here is the order of the three steps and what each one costs:',
  '',
  '| Step | Time | Lock | Rows touched |',
  '|---|---|---|---|',
  '| Add the column | 40 ms | Brief | 0 |',
  '| Backfill in batches of 10k | 6 min | None | 1.2M |',
  '| Index settled_at | 3 min | None | 1.2M |',
  '| Verify with ledger-core | 1 min | None | 0 |',
  '| Set NOT NULL | 2 s | Full scan | 1.2M |',
  '| Drop the old default | 30 ms | Brief | 0 |',
  '',
  'Only the last two steps need a quiet window.',
].join('\n');

const EARLIER: ReadonlyArray<TurnEvent> = [
  {
    kind: 'user_text',
    runId: EARLIER_RUN,
    text: 'Open PR #309 on payments-api and tell me what it changes.',
    at: NOW,
  },
  {
    kind: 'assistant_text',
    runId: EARLIER_RUN,
    delta: 'PR #309 adds `settled_at` to `ledger_entries` and reads it in the refund path.',
    at: NOW,
  },
  {
    kind: 'user_text',
    runId: LIVE_RUN,
    text: 'Why does ledger-core reject it? Keep it short, I need to answer the team.',
    at: NOW,
  },
];

type AnswerParams = {
  readonly copies: number;
  readonly isTable: boolean;
};

const answerEventOf = ({ copies, isTable }: AnswerParams): TurnEvent => ({
  kind: 'assistant_text',
  runId: LIVE_RUN,
  delta: isTable
    ? TABLE_ANSWER
    : Array.from({ length: copies }, (_, copy) =>
        copy === 0 ? ANSWER : ANSWER.replace('## Why', `## Part ${copy + 1}: why`),
      ).join('\n\n'),
  at: NOW,
});

export const RevealAnswerScene = ({ theme, landsAfterMs, copies, isLive, isTable }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyDocumentTheme({ theme });
    seedActivityRunScene();
    useAppStore.setState({
      sessions: [SESSION],
      sessionPhaseRuns: { [SESSION.id]: [AGENT] },
      selectedAgentId: { [SESSION.id]: AGENT_ID },
      agentPane: { [SESSION.id]: 'transcript' },
      agentTurnState: { [AGENT_ID]: { kind: 'running', runId: LIVE_RUN, startedAt: NOW } },
      transcripts: { [AGENT_ID]: EARLIER },
      loadAgentTranscript: async () => undefined,
      sessionOpenQuestions: { [SESSION.id]: [] },
      sessionAnsweredQuestions: { [SESSION.id]: [] },
      sessionEvents: { [SESSION.id]: [] },
    });
    setIsReady(true);
    const timer = setTimeout(() => {
      if (isLive) {
        liveTextRegistry.mark({ runId: LIVE_RUN });
      }
      const state = useAppStore.getState();
      state.appendTurnEvent(AGENT_ID, SESSION.id, answerEventOf({ copies, isTable }));
      useAppStore.setState({
        agentTurnState: { [AGENT_ID]: { kind: 'idle', lastActivityAt: NOW } },
      });
    }, landsAfterMs);
    return () => clearTimeout(timer);
  }, [theme, landsAfterMs, copies, isLive, isTable]);

  if (!isReady) {
    return null;
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-background">
      <ChatView session={SESSION} mode="conversation" />
    </div>
  );
};
