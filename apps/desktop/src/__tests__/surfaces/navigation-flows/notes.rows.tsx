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

export const startFakeNoteFix = async ({
  sessionId,
  threadIds,
}: {
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
}): Promise<Record<string, never>> => {
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
  return {};
};

const finishFakeRun = ({ sessionId }: Ctx): void => {
  const attempts = (useAppStore.getState().sessionResolveAttempts[sessionId] ?? []).map(
    (attempt): ResolveAttempt => ({ ...attempt, phase: 'finished', endedAt: Date.now() }),
  );
  useAppStore.setState({
    sessionResolveAttempts: { [sessionId]: attempts },
    sessionPhaseRuns: { [sessionId]: [] },
  });
  writeQueue({
    sessionId,
    patch: (entry) => ({
      ...entry,
      thread: { ...entry.thread, state: 'fixed', stage: 'proposed', disposition: 'fix' },
    }),
  });
};

const drawerPanel = (): HTMLElement | null => screen.queryByRole('region', { name: 'Your notes' });

const addNoteOnFile = async ({
  file,
  body,
}: {
  readonly file: string;
  readonly body: string;
}): Promise<void> => {
  const tree = await screen.findByRole('navigation', { name: 'Changed files' });
  await click(within(tree).getByRole('button', { name: `Comment on ${file}` }));
  const field = await screen.findByRole('textbox', { name: /Note on this file/ });
  fireEvent.change(field, { target: { value: body } });
  await settle();
  await click(screen.getByRole('button', { name: 'Add note' }));
  await settle();
};

const hasNoteCount = async (count: number): Promise<void> => {
  await waitFor(
    () => expect(screen.getByRole('button', { name: `Notes ${count}` })).toBeDefined(),
    WAIT,
  );
};

const FIRST_FILE = 'postCredit.ts';
const SECOND_FILE = 'applyWebhook.ts';

export const NOTES_ROWS: ReadonlyArray<Row> = [
  {
    name: 'notes: Files counts the notes, the drawer opens on demand and Comments never lists them',
    covers: ['navigate', 'toggleDrawer'],
    seed: 'issue',
    open: async (ctx) => {
      installNotesStore(ctx);
      await openCrumb(/^Diff/);
      await branchTab('files')(ctx);
      await addNoteOnFile({ file: FIRST_FILE, body: 'Cap the retries at three' });
      await addNoteOnFile({ file: SECOND_FILE, body: 'Log the duplicate once' });
      await hasNoteCount(2);
      expect(drawerPanel()).toBeNull();

      await clickButton('Notes 2');
      const panel = await screen.findByRole('region', { name: 'Your notes' }, WAIT);
      await waitFor(() => expect(within(panel).getByText('2 open')).toBeDefined(), WAIT);
      await click(within(panel).getByRole('button', { name: 'Fix 2' }));
      await waitFor(
        () =>
          expect(within(panel).getByTestId('resolve-run-status').textContent).toContain(
            'Fixing 1 of 2',
          ),
        WAIT,
      );

      finishFakeRun(ctx);
      await settle();
      await click(within(panel).getAllByRole('button', { name: 'Close the note' })[0]!);
      await hasNoteCount(1);

      await click(await screen.findByRole('tab', { name: /^Comments/ }));
    },
    lands: async (ctx) => {
      await branchTab('comments')(ctx);
      expect(await screen.findByText('No pull request yet', undefined, WAIT)).toBeDefined();
      expect(screen.getByRole('button', { name: 'Create pull request' })).toBeDefined();
      expect(screen.queryByText('Log the duplicate once')).toBeNull();
      expect(screen.queryByText('Cap the retries at three')).toBeNull();
    },
  },
  {
    name: 'notes: the door of a note thread lands on Files with the drawer open',
    covers: ['openReviewTarget'],
    seed: 'issue',
    open: async (ctx) => {
      installNotesStore(ctx);
      await openCrumb(/^Diff/);
      await branchTab('files')(ctx);
      await addNoteOnFile({ file: FIRST_FILE, body: 'Cap the retries at three' });
      await click(await screen.findByRole('tab', { name: /^Commits/ }));
      const threadId = fakeNotes[0]?.threadId ?? '';
      await openReviewThread({ sessionId: ctx.sessionId, threadId });
      await settle();
    },
    lands: async (ctx) => {
      await branchTab('files')(ctx);
      const panel = await screen.findByRole('region', { name: 'Your notes' }, WAIT);
      expect(within(panel).getByText('1 open')).toBeDefined();
    },
  },
  {
    name: 'notes: the fix run of a note thread opens its transcript beside Files',
    covers: ['navigate'],
    seed: 'issue',
    open: async (ctx) => {
      installNotesStore(ctx);
      await openCrumb(/^Diff/);
      await branchTab('files')(ctx);
      await addNoteOnFile({ file: FIRST_FILE, body: 'Cap the retries at three' });
      await startFakeNoteFix({
        sessionId: ctx.sessionId,
        threadIds: [fakeNotes[0]?.threadId ?? ''],
      });
      await click(await screen.findByRole('tab', { name: /^Commits/ }));
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
