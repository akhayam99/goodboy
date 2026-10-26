import { useEffect, useState } from 'react';
import { PageColumn } from '@goodboy/ui';
import type { OpenQuestion, OpenQuestionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { TranscriptRow } from '../../../../../features/chat/utils/cluster-operations';
import { ChatImageLoaderProvider } from '../../../../../features/chat/components/ChatView/ChatImageLoaderProvider';
import { TranscriptRows } from '../../../../../features/chat/components/ChatView/TranscriptRows';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { sceneClock } from '../../sceneClock';
import {
  CHAT_AGENT_RESOLVER_ID,
  CHAT_SESSION,
  CHAT_SESSION_ID,
  PROJECTS,
  SESSIONS,
  WORKSPACE,
  WORKSPACE_ID,
  noop,
} from '../flow-audit/fixtures';
import { ShellFrame, seedShellChrome } from '../shellChrome';

const clock = sceneClock({ anchor: '2026-10-12T09:30:00.000Z' });

const LONG_REPLY =
  'The retry path in notify-relay posts the credit twice because the webhook handler acknowledges after the ledger write, so a slow acknowledgement makes the sender retry while the first write is still committing. The fix is to key the credit on the delivery id and acknowledge first, which keeps a retried delivery from reaching the ledger a second time.';

const QUESTION_REPLY =
  'The remote tip moved, so I am stopping before the push. The ledger-core remote is at `be3d04fc9`, not `29aa41a98`.';

const QUESTION: OpenQuestion = {
  id: brandedId<OpenQuestionId>({ value: 'mock-0251b-question' }),
  sessionId: CHAT_SESSION_ID,
  text: 'The ledger-core remote is at be3d04fc9, not 29aa41a98. How do I proceed?',
  suggestedAnswers: ['Use the new lease and push', 'Stop, inspect the remote commits first'],
  recommendedAnswer: 'Stop, inspect the remote commits first',
  selectMode: 'one',
  isBlocking: true,
  userAnswer: null,
  turnOrdinal: 2,
  status: 'open',
  createdAt: clock.iso({ at: '2026-10-12T09:35:00.000Z' }),
};

const QUESTIONS_BY_TURN: ReadonlyMap<number | null, ReadonlyArray<OpenQuestion>> = new Map([
  [2, [QUESTION]],
]);

const CODE_REPLY = [
  'Here is the guard, keyed on the delivery id so a retried webhook never reaches the ledger twice:',
  '',
  '```ts',
  'export const creditOnce = async ({ deliveryId, invoiceId, amount }: CreditParams) => {',
  '  const isFirst = await deliveries.claim({ deliveryId });',
  '  if (!isFirst) {',
  '    return { status: "duplicate", invoiceId };',
  '  }',
  '  await ledger.post({ invoiceId, amount, source: deliveryId });',
  '  return { status: "posted", invoiceId };',
  '};',
  '```',
].join('\n');

const ROWS: ReadonlyArray<TranscriptRow> = [
  {
    kind: 'item',
    key: 'p0251b-user',
    item: {
      kind: 'user_text',
      key: 'p0251b-user',
      text: 'Resume the Acme payments-api fix: finish the remaining items now, and scope this cluster only.',
      at: clock.iso({ at: '2026-10-12T09:00:00.000Z' }),
    },
  },
  {
    kind: 'item',
    key: 'p0251b-reply',
    item: { kind: 'assistant_text', key: 'p0251b-reply', text: LONG_REPLY },
  },
  {
    kind: 'item',
    key: 'p0251b-code',
    item: { kind: 'assistant_text', key: 'p0251b-code', text: CODE_REPLY },
  },
  {
    kind: 'item',
    key: 'p0251b-user-two',
    item: {
      kind: 'user_text',
      key: 'p0251b-user-two',
      text: 'Good. Push the ledger-core branch once the notify-relay tests are green, and tell me if anything on the remote moved.',
      at: clock.iso({ at: '2026-10-12T09:12:00.000Z' }),
    },
  },
  {
    kind: 'item',
    key: 'p0251b-question',
    item: { kind: 'assistant_text', key: 'p0251b-question', text: QUESTION_REPLY },
  },
];

const transcript = (
  <div className="h-full overflow-hidden">
    <PageColumn>
      <ul className="flex flex-col gap-3 py-4" aria-live="polite" aria-relevant="additions">
        <ChatImageLoaderProvider sessionId={CHAT_SESSION_ID}>
          <TranscriptRows
            rows={ROWS}
            oqByTurnOrdinal={QUESTIONS_BY_TURN}
            sessionId={CHAT_SESSION_ID}
            selectedAgentId={CHAT_AGENT_RESOLVER_ID}
            workingDir={null}
            onRefreshAuth={noop}
            onOpenDiff={noop}
            isThinking={false}
            thinkingPhrase="Thinking"
            onRetryRun={noop}
            retryingRunId={null}
          />
        </ChatImageLoaderProvider>
      </ul>
    </PageColumn>
  </div>
);

type SceneProps = Record<never, never>;

const TranscriptWidthScene = ({}: SceneProps) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    useAppStore.setState({
      workspaces: [WORKSPACE],
      currentWorkspaceId: WORKSPACE_ID,
      projects: PROJECTS,
    });
    seedShellChrome({
      session: CHAT_SESSION,
      siblings: SESSIONS.filter((session) => session.id !== CHAT_SESSION_ID),
      branches: {},
      telemetryAt: clock.iso({ at: '2026-10-12T09:10:00.000Z' }),
      lens: null,
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return <ShellFrame session={CHAT_SESSION} main={transcript} />;
};

export const U25_P_0251B_SCENES = {
  'transcript-width': () => <TranscriptWidthScene />,
};
