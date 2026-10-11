import { expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { AgentId, DiffComment, IsoDateTime, ResolveAttempt, SessionId } from '@goodboy/types';
import { noteRow } from '../../../app/components/MockScene/scenes/resolveGitlabSeed';
import { openReviewThread } from '../../../features/review/openReviewThread';
import { agentPlace } from '../../../store/slices/navigation/place';
import { selectDisplayedMount } from '../../../store/slices/project-mounts/selectors';
import { filesRailBridge } from './files-rail.runner';
import {
  type Ctx,
  type Row,
  WAIT,
  branchTab,
  click,
  clickButton,
  openCrumb,
  settle,
  useAppStore,
  findSection,
} from './harness';

export const notesBridge = filesRailBridge;

const NOW = '2026-10-07T09:00:00.000Z' as IsoDateTime;
const MOUNT_PATH_LAUNCH = 'mock-notes-launch';
const MOUNT_PATH_BATCH = 'mock-notes-batch';

let nextId = 0;

type FakeNote = {
  readonly note: DiffComment;
  readonly threadId: string;
};

const fakeNotes: Array<FakeNote> = [];

const reset = (): void => {
  nextId = 0;
  fakeNotes.length = 0;
};

const writeRows = ({ sessionId }: { readonly sessionId: SessionId }): void => {
  const state = useAppStore.getState();
  useAppStore.setState({
    diffComments: { ...state.diffComments, [sessionId]: fakeNotes.map((entry) => entry.note) },
  });
};

const rowsOf = ({ sessionId }: { readonly sessionId: SessionId }) =>
  fakeNotes.map(({ note }) => {
    const row = noteRow({ note });
    return {
      item: { ...row.item, sessionId },
      thread: { ...row.thread, sessionId, projectId: note.projectId ?? null },
    };
  });

const writeQueue = ({
  sessionId,
  patch = (entry) => entry,
}: {
  readonly sessionId: SessionId;
  readonly patch?: (entry: ReturnType<typeof rowsOf>[number]) => ReturnType<typeof rowsOf>[number];
}): void => {
  useAppStore.setState({
    sessionResolveQueueItems: {
      ...useAppStore.getState().sessionResolveQueueItems,
      [sessionId]: rowsOf({ sessionId }).map(patch),
    },
  });
};

const installNotesStore = ({ sessionId }: Ctx): void => {
  reset();
  useAppStore.setState({
    loadDiffComments: async () => undefined,
    loadResolveSession: async () => undefined,
    addDiffComment: async (targetSession, filePath, body, anchor) => {
      const mount = selectDisplayedMount({
        state: useAppStore.getState(),
        sessionId: targetSession,
      });
      nextId += 1;
      const note: DiffComment = {
        id: `journey-note-${nextId}`,
        sessionId: targetSession,
        filePath,
        body,
        status: 'open',
        createdAt: NOW,
        ...(anchor !== undefined && { anchor }),
        authorKind: 'user',
        ...(mount !== null && { projectId: mount.projectId, branch: mount.branch }),
      };
      fakeNotes.push({ note, threadId: `note:${note.id}` });
      writeRows({ sessionId: targetSession });
      writeQueue({ sessionId: targetSession });
    },
    closeResolvedNote: async ({ sessionId: targetSession, threadId }) => {
      const found = fakeNotes.find((entry) => entry.threadId === threadId);
      if (found === undefined) {
        return;
      }
      const index = fakeNotes.indexOf(found);
      fakeNotes[index] = { ...found, note: { ...found.note, status: 'resolved' } };
      writeRows({ sessionId: targetSession });
      writeQueue({
        sessionId: targetSession,
        patch: (entry) =>
          entry.thread.threadId === threadId
            ? { ...entry, thread: { ...entry.thread, state: 'closed', stage: 'resolved' } }
            : entry,
      });
    },
  });
  writeRows({ sessionId });
};

const attemptOf = ({
  sessionId,
  index,
  threadId,
  phase,
  mountPath,
}: {
  readonly sessionId: SessionId;
  readonly index: number;
  readonly threadId: string;
  readonly phase: ResolveAttempt['phase'];
  readonly mountPath: string;
}): ResolveAttempt => ({
  id: `journey-attempt-${index}`,
  sessionId,
  agentId: `journey-agent-${index}` as AgentId,
  prNumber: null,
  threadIds: [threadId],
  launchId: MOUNT_PATH_LAUNCH,
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  effort: 'medium',
  instructions: null,
  phase,
  mountTarget: { mountId: 'journey-mount' as never, mountRevision: 1, worktreePath: mountPath },
  startedAt: Date.now() - 60_000,
  endedAt: phase === 'finished' ? Date.now() : null,
  error: null,
  createdAt: Date.now() - 60_000 + index,
  batchId: MOUNT_PATH_BATCH,
  copyPath: null,
  launchChoice: null,
});

const startFakeNoteFix = async ({
  sessionId,
  threadIds,
}: {
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
}): Promise<{ readonly batchId: string; readonly launchId: string; readonly agentId: AgentId }> => {
  const mountPath =
    selectDisplayedMount({ state: useAppStore.getState(), sessionId })?.worktreePath ?? '';
  const attempts = threadIds.map((threadId, index) =>
    attemptOf({ sessionId, index, threadId, phase: index === 0 ? 'running' : 'queued', mountPath }),
  );
  useAppStore.setState({
    sessionResolveAttempts: { [sessionId]: attempts },
    sessionPhaseRuns: {
      [sessionId]: attempts.map((attempt, index) => ({
        id: attempt.agentId,
        sessionId,
        ordinal: 90 + index,
        name: `Fix: note ${index + 1}`,
        kind: 'resolver',
        status: index === 0 ? 'running' : 'pending',
        startedAt: NOW,
      })) as never,
    },
  });
  writeQueue({
    sessionId,
    patch: (entry) => {
      const attempt = attempts.find((candidate) =>
        candidate.threadIds.includes(entry.thread.threadId),
      );
      return attempt === undefined
        ? entry
        : {
            ...entry,
            thread: {
              ...entry.thread,
              state: 'working',
              stage: 'working',
              activeAttemptId: attempt.id,
            },
          };
    },
  });
  const first = attempts[0];
  if (first === undefined) {
    throw new Error('No notes selected');
  }
  return { batchId: MOUNT_PATH_BATCH, launchId: 'notes-launch', agentId: first.agentId };
};

type NoteTarget = {
  readonly file: string;
  readonly body: string;
};

const addNoteOnFile = async ({ file, body }: NoteTarget): Promise<void> => {
  const card = await screen.findByRole('region', { name: new RegExp(`${file}$`) }, WAIT);
  await click(within(card).getByRole('button', { name: 'Comment' }));
  const field = await screen.findByRole('textbox', { name: /Note on this file/ });
  fireEvent.change(field, { target: { value: body } });
  await settle();
  await click(screen.getByRole('button', { name: 'Add note' }));
  await settle();
};

const hasFixComments = async (count: number): Promise<void> => {
  await waitFor(
    () => expect(screen.getByRole('button', { name: `Fix comments ${count}` })).toBeDefined(),
    WAIT,
  );
};

const FIRST_FILE = 'postCredit.ts';
const SECOND_FILE = 'applyWebhook.ts';

export const NOTES_ROWS: ReadonlyArray<Row> = [
  {
    name: 'notes: Files counts the notes in Fix comments, and Comments lists them with no pull request',
    covers: ['navigate', 'openDrawer'],
    seed: 'issue',
    open: async (ctx) => {
      installNotesStore(ctx);
      await openCrumb(/^Branch/);
      await click(await findSection(/^Files/));
      await branchTab('files')(ctx);
      await addNoteOnFile({ file: FIRST_FILE, body: 'Cap the retries at three' });
      await addNoteOnFile({ file: SECOND_FILE, body: 'Log the duplicate once' });
      await hasFixComments(2);
      expect(useAppStore.getState().drawer).toBeNull();

      await clickButton('Fix comments 2');
      await waitFor(() => expect(useAppStore.getState().drawer?.kind).toBe('fix-comments'), WAIT);
      useAppStore.getState().closeDrawer();

      await click(await findSection(/^Comments/));
    },
    lands: async (ctx) => {
      await branchTab('comments')(ctx);
      expect(
        (await screen.findAllByText(/Cap the retries at three/, undefined, WAIT)).length,
      ).toBeGreaterThan(0);
      expect(screen.getAllByText(/Log the duplicate once/).length).toBeGreaterThan(0);
      expect(screen.queryByText('No pull request yet')).toBeNull();
      expect(screen.queryByRole('tab', { name: /^On GitHub/ })).toBeNull();
      expect(screen.getByRole('button', { name: /^Fix comments/ })).toBeDefined();
    },
  },
  {
    name: 'notes: the door of a note thread lands on Files at the note, with no drawer, before a pull request',
    covers: ['openReviewTarget'],
    seed: 'issue',
    open: async (ctx) => {
      installNotesStore(ctx);
      await openCrumb(/^Branch/);
      await click(await findSection(/^Files/));
      await branchTab('files')(ctx);
      await addNoteOnFile({ file: FIRST_FILE, body: 'Cap the retries at three' });
      await click(await findSection(/^Commits/));
      const threadId = fakeNotes[0]?.threadId ?? '';
      await openReviewThread({ sessionId: ctx.sessionId, threadId });
      await settle();
    },
    lands: async (ctx) => {
      await branchTab('files')(ctx);
      expect(await screen.findByRole('article', { name: /^Note from You/ }, WAIT)).toBeDefined();
      expect(screen.getByText('Cap the retries at three')).toBeDefined();
      expect(useAppStore.getState().drawer).toBeNull();
    },
  },
  {
    name: 'notes: the door of a note thread lands on its thread in Comments once the branch has a pull request',
    covers: ['openReviewTarget'],
    seed: 'pr',
    open: async (ctx) => {
      installNotesStore(ctx);
      await openCrumb(/^Branch/);
      await click(await findSection(/^Files/));
      await branchTab('files')(ctx);
      await addNoteOnFile({ file: FIRST_FILE, body: 'Cap the retries at three' });
      await click(await findSection(/^Commits/));
      const threadId = fakeNotes[0]?.threadId ?? '';
      await openReviewThread({ sessionId: ctx.sessionId, threadId });
      await settle();
    },
    lands: async (ctx) => {
      await branchTab('comments')(ctx);
      expect(
        (await screen.findAllByText(/Cap the retries at three/, undefined, WAIT)).length,
      ).toBeGreaterThan(0);
      expect(useAppStore.getState().drawer).toBeNull();
    },
  },
  {
    name: 'notes: the fix run of a note thread opens its transcript beside Files',
    covers: ['navigate'],
    seed: 'issue',
    open: async (ctx) => {
      installNotesStore(ctx);
      await openCrumb(/^Branch/);
      await click(await findSection(/^Files/));
      await branchTab('files')(ctx);
      await addNoteOnFile({ file: FIRST_FILE, body: 'Cap the retries at three' });
      await startFakeNoteFix({
        sessionId: ctx.sessionId,
        threadIds: [fakeNotes[0]?.threadId ?? ''],
      });
      await click(await findSection(/^Commits/));
      useAppStore.getState().navigate({
        to: agentPlace({ sessionId: ctx.sessionId, agentId: 'journey-agent-0' as AgentId }),
      });
      await settle();
    },
    lands: async (ctx) => {
      await branchTab('files')(ctx);
      await waitFor(() => expect(useAppStore.getState().drawer?.kind).toBe('transcript'), WAIT);
    },
  },
];
