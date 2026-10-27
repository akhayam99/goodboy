import {
  brandId,
  type Agent,
  type AgentId,
  type DiffComment,
  type OpenQuestion,
  type ResolveQueueItemWithThread,
} from '@goodboy/types';
import { noteThreadId } from '../../../../../features/resolve/notes/noteThread';
import { useAppStore } from '../../../../../store';
import { openFixComments } from '../../../../../store/slices/resolve/openFixComments';
import { sceneClock } from '../../sceneClock';
import { SESSION_ID, buildItem, buildThread } from '../resolveSeed';
import { seedBulkScene } from '../bulkSeed';

const clock = sceneClock({ anchor: '2026-10-10T09:40:00.000Z' });

export type CommentsTriagePhase = 'mixed' | 'question' | 'applied';

type Params = {
  readonly phase: CommentsTriagePhase;
};

const AGENT_ID = brandId<AgentId>({ value: 'mock-bulk-agent' });
const NOTE_ID = 'mock-note-triage-cap';
const QUESTION_TEXT =
  'Which MAX_RETRY_ATTEMPTS should stay, the one in retryPolicy.ts or config.ts?';

const resolverAgent = (): Agent => ({
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 1,
  name: 'Fix comments · 5 comments',
  status: 'completed',
  kind: 'resolver',
  sourceKind: 'review_comment',
  startedAt: clock.iso({ at: '2026-10-10T09:30:00.000Z' }),
  doneAt: clock.iso({ at: '2026-10-10T09:36:00.000Z' }),
});

type KeyParams = {
  readonly key: string;
};

const threadOf = ({ key }: KeyParams): string => `PRRT_bulk_${key}`;

type Reshape = (entry: ResolveQueueItemWithThread) => ResolveQueueItemWithThread;

type PatchParams = {
  readonly patch: Partial<ResolveQueueItemWithThread['thread']>;
};

const reshapeThread =
  ({ patch }: PatchParams): Reshape =>
  (entry) => ({ ...entry, thread: { ...entry.thread, ...patch } });

const RESHAPES: Readonly<Record<string, Reshape>> = {
  [threadOf({ key: 'r2' })]: reshapeThread({
    patch: {
      disposition: 'reply',
      replyDraft: 'Already covered: the log line carries the delivery id only.',
    },
  }),
  [threadOf({ key: 'r3' })]: reshapeThread({
    patch: { state: 'working', stage: 'working', disposition: null, replyDraft: null },
  }),
  [threadOf({ key: 'r5' })]: reshapeThread({
    patch: {
      state: 'needs_answer',
      stage: 'asking',
      disposition: null,
      replyDraft: null,
      question: QUESTION_TEXT,
    },
  }),
};

const APPLIED: ReadonlyArray<string> = ['r1', 'r4'];

type EntryParams = {
  readonly entry: ResolveQueueItemWithThread;
};

const appliedOf = ({ entry }: EntryParams) =>
  APPLIED.some((key) => entry.thread.threadId === threadOf({ key }))
    ? {
        item: { ...entry.item, approvalState: 'accepted' as const, approvedRevision: 1 },
        thread: {
          ...entry.thread,
          stage: 'approved' as const,
          commitShas: [`triage${entry.thread.threadId.slice(-2)}9e4c1a7`],
        },
      }
    : entry;

const noteEntry = (): ResolveQueueItemWithThread => ({
  item: buildItem({
    id: `mock-note-item-${NOTE_ID}`,
    threadId: noteThreadId({ noteId: NOTE_ID }),
    approvalState: 'none',
    approvedRevision: null,
    deferredAt: null,
    deliveredAt: null,
    candidateRevision: 1,
    createdMinutesAgo: 8,
  }),
  thread: {
    ...buildThread({
      threadId: noteThreadId({ noteId: NOTE_ID }),
      state: 'fixed',
      stage: 'proposed',
      revision: 1,
      activeAttemptId: null,
      disposition: 'no_change',
      replyDraft: null,
      question: null,
      createdMinutesAgo: 8,
    }),
    prNumber: null,
    originKind: 'diff_comment',
    diffCommentId: NOTE_ID,
  },
});

const note = (): DiffComment => ({
  id: NOTE_ID,
  sessionId: SESSION_ID,
  filePath: 'src/webhooks/retryPolicy.ts',
  body: 'The cap already exists two lines above, nothing to add here.',
  status: 'open',
  createdAt: clock.iso({ at: '2026-10-10T09:32:00.000Z' }),
  anchor: { side: 'new', lineNumber: 21 },
  authorKind: 'user',
});

type QuestionParams = {
  readonly base: OpenQuestion;
};

const questionOf = ({ base }: QuestionParams): OpenQuestion => ({
  ...base,
  text: QUESTION_TEXT,
  suggestedAnswers: ['Keep the one in retryPolicy.ts', 'Keep the one in config.ts'],
  recommendedAnswer: 'Keep the one in retryPolicy.ts',
  createdAt: clock.iso({ at: '2026-10-10T09:35:00.000Z' }),
});

export const commentsTriageSeed = ({ phase }: Params): void => {
  seedBulkScene({ stage: 'answers' });
  const [questionBase] = useAppStore.getState().sessionOpenQuestions[SESSION_ID] ?? [];
  seedBulkScene({ stage: 'review' });
  const state = useAppStore.getState();
  const base = (state.sessionResolveQueueItems[SESSION_ID] ?? []).map((entry) => {
    const reshape = RESHAPES[entry.thread.threadId];
    const shaped = reshape === undefined ? entry : reshape(entry);
    return phase === 'applied' ? appliedOf({ entry: shaped }) : shaped;
  });
  const keep =
    phase === 'question'
      ? base.filter((entry) => entry.thread.threadId === threadOf({ key: 'r5' }))
      : [...base, noteEntry()];
  useAppStore.setState({
    sessionResolveQueueItems: { [SESSION_ID]: keep },
    sessionOpenQuestions: {
      [SESSION_ID]: questionBase === undefined ? [] : [questionOf({ base: questionBase })],
    },
    sessionPhaseRuns: { [SESSION_ID]: [resolverAgent()] },
    diffComments: { [SESSION_ID]: phase === 'question' ? [] : [note()] },
    reviewSelection: { [SESSION_ID]: [] },
    reviewBulkAccepts: { [SESSION_ID]: null },
  });
  openFixComments({
    openDrawer: state.openDrawer,
    sessionId: SESSION_ID,
    mountId: null,
    threadIds: [],
  });
};
