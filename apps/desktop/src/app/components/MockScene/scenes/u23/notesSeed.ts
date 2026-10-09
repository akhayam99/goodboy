import type { Agent, AgentId, ResolveAttempt } from '@goodboy/types';
import { reviewNotesDrawer } from '../../../../../features/resolve/notes/notesDrawer';
import { useAppStore } from '../../../../../store';
import {
  CTX_PAYMENTS_ID,
  CTX_PAYMENTS_WORKTREE,
  CTX_SESSION_ID,
  seedContextBase,
} from '../brand/contextBase';
import { BRAND_SESSION } from '../brand/canon';
import { APPLY_WEBHOOK_PATH, POST_CREDIT_PATH } from '../brand/contextDiffPatch';
import { NOTE_IDS, resolveNotesFor, type NotePlace } from '../resolveNotesSeed';
import { msAgo } from '../resolveSeed';

export type NotesVariant = 'files' | 'fixing' | 'ready' | 'empty' | 'comments-no-pr' | 'all';

type NoteKey = keyof typeof NOTE_IDS;

const NOTES_PLACES: Readonly<Record<NoteKey, NotePlace>> = {
  open: { filePath: APPLY_WEBHOOK_PATH, line: 26 },
  openSecond: { filePath: POST_CREDIT_PATH, line: 20 },
  working: { filePath: APPLY_WEBHOOK_PATH, line: 13 },
  needs: { filePath: POST_CREDIT_PATH, line: 11 },
  ready: { filePath: APPLY_WEBHOOK_PATH, line: 18 },
  failed: { filePath: POST_CREDIT_PATH, line: 7 },
  done: { filePath: APPLY_WEBHOOK_PATH, line: 4 },
};

const KEYS: Readonly<Record<NotesVariant, ReadonlyArray<NoteKey>>> = {
  files: ['open', 'openSecond', 'ready'],
  fixing: ['open', 'openSecond'],
  ready: ['ready', 'failed'],
  empty: [],
  'comments-no-pr': ['open'],
  all: ['open', 'openSecond', 'working', 'needs', 'ready', 'failed', 'done'],
};

const LAUNCH_ID = 'mock-notes-launch';
const BATCH_ID = 'mock-notes-batch';

const laneAgent = ({
  index,
  status,
}: {
  readonly index: number;
  readonly status: Agent['status'];
}): Agent =>
  ({
    id: `mock-notes-agent-lane-${index}` as AgentId,
    sessionId: CTX_SESSION_ID,
    ordinal: 70 + index,
    name: `Fix: note ${index + 1}`,
    kind: 'resolver',
    status,
    startedAt: new Date(msAgo({ minutes: 4 })).toISOString(),
    providerOverride: 'anthropic',
    modelOverride: 'claude-sonnet-5-5',
  }) as Agent;

const asLane = ({
  attempts,
}: {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
}): ReadonlyArray<ResolveAttempt> =>
  attempts.map((attempt, index) => ({
    ...attempt,
    agentId: `mock-notes-agent-lane-${index}` as AgentId,
    phase: index === 0 ? 'running' : 'queued',
    startedAt: index === 0 ? msAgo({ minutes: 4 }) : null,
    createdAt: msAgo({ minutes: 5 - index }),
    launchId: LAUNCH_ID,
    batchId: BATCH_ID,
  }));

export const seedNotesScene = ({ variant }: { readonly variant: NotesVariant }): void => {
  seedContextBase({ lens: 'branch' });
  const wanted = new Set(KEYS[variant].map((key) => NOTE_IDS[key]));
  const seeded = resolveNotesFor({
    sessionId: CTX_SESSION_ID,
    places: NOTES_PLACES,
    isStarted: variant === 'fixing',
  });
  const notes = seeded.notes
    .filter((note) => wanted.has(note.id))
    .map((note) => ({
      ...note,
      projectId: CTX_PAYMENTS_ID,
      branch: BRAND_SESSION.branch,
    }));
  const entries = seeded.entries.filter((entry) => wanted.has(entry.thread.diffCommentId ?? ''));
  const attempts = seeded.attempts.filter((attempt) =>
    attempt.threadIds.some((threadId) =>
      entries.some((entry) => entry.thread.threadId === threadId),
    ),
  );
  const isFixing = variant === 'fixing';
  useAppStore.setState({
    diffComments: { [CTX_SESSION_ID]: notes },
    sessionResolveQueueItems: { [CTX_SESSION_ID]: entries },
    sessionResolveAttempts: { [CTX_SESSION_ID]: isFixing ? asLane({ attempts }) : attempts },
    sessionPhaseRuns: {
      [CTX_SESSION_ID]: isFixing
        ? [laneAgent({ index: 0, status: 'running' }), laneAgent({ index: 1, status: 'pending' })]
        : [],
    },
    diffFocus: {},
    branchTab: { [CTX_SESSION_ID]: variant === 'comments-no-pr' ? 'comments' : 'files' },
    branchThreadId: {},
    loadDiffComments: async () => undefined,
    loadResolveSession: async () => undefined,
    drawer:
      variant === 'comments-no-pr'
        ? null
        : reviewNotesDrawer({
            sessionId: CTX_SESSION_ID,
            mountPath: CTX_PAYMENTS_WORKTREE,
          }),
  });
};
