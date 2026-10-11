import { useAppStore } from '../../../../../store';
import { CTX_PAYMENTS_ID, CTX_SESSION_ID, seedContextBase } from '../brand/contextBase';
import { BRAND_SESSION } from '../brand/canon';
import { APPLY_WEBHOOK_PATH, POST_CREDIT_PATH } from '../brand/contextDiffPatch';
import { NOTE_IDS, resolveNotesFor, type NotePlace } from '../resolveNotesSeed';

export type NotesVariant = 'files' | 'comments-no-pr' | 'all';

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
  'comments-no-pr': ['open', 'openSecond'],
  all: ['open', 'openSecond', 'working', 'needs', 'ready', 'failed', 'done'],
};

export const seedNotesScene = ({ variant }: { readonly variant: NotesVariant }): void => {
  seedContextBase({ lens: 'branch' });
  const wanted = new Set(KEYS[variant].map((key) => NOTE_IDS[key]));
  const seeded = resolveNotesFor({
    sessionId: CTX_SESSION_ID,
    places: NOTES_PLACES,
    isStarted: false,
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
  useAppStore.setState({
    diffComments: { [CTX_SESSION_ID]: notes },
    sessionResolveQueueItems: { [CTX_SESSION_ID]: entries },
    sessionResolveAttempts: { [CTX_SESSION_ID]: attempts },
    sessionPhaseRuns: { [CTX_SESSION_ID]: [] },
    diffFocus: {},
    branchTab: { [CTX_SESSION_ID]: variant === 'comments-no-pr' ? 'comments' : 'files' },
    branchThreadId: {},
    loadDiffComments: async () => undefined,
    loadResolveSession: async () => undefined,
    drawer: null,
  });
};
