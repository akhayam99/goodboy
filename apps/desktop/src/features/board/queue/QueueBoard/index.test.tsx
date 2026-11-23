// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  brandId,
  type OpenQuestionId,
  type SessionAttentionReason,
  type SessionId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { questionPlace, sessionPlace } from '../../../../store/slices/navigation/place';
import { attentionPlace } from '../../../session/attentionPlace';
import type { Session } from '@goodboy/types';
import type { StartMergeTrainParams } from '../../../../store/slices/pr-series/startMergeTrain';
import {
  harborline,
  ledgerCore,
  mergedGithub,
  mountGithubOf,
  mountOf,
  notifyRelay,
  openQuestionFor,
  seedColumn,
  sessionOf,
} from '../../../workspace/testing/sessionColumn';
import type { QueueMove } from '../needsYouOf';
import { QueueBoard } from '.';
import { queueLandingOf } from '../queueLandingOf';
import { useQueueSends } from './useQueueSends';
import { liveMounts } from '../../../overlap/liveMounts';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ live_work: [] });
  useQueueSends.setState({ pending: {}, notNow: new Set(), drafts: {} });
});

afterEach(() => {
  useQueueSends.getState().flushAll();
  cleanup();
  liveMounts.reset();
});

const quiet = sessionOf({ goal: 'Backfill ledger balances' });
const asking = sessionOf({ goal: 'Fix webhook retries' });
const second = sessionOf({ goal: 'Rate-limit the payout API' });
const WAIT = { timeout: 3000 };

type SessionParams = {
  readonly sessionId: string;
};

const moveIdOf = ({ sessionId }: SessionParams): string =>
  `${sessionId}:question:question-${sessionId}`;

type MoveButtonParams = {
  readonly moveId: string;
};

const moveButton = ({ moveId }: MoveButtonParams): HTMLElement => {
  const found = document.querySelector<HTMLElement>(`button[data-queue-move="${moveId}"]`);
  if (found === null) {
    throw new Error(`no row for ${moveId}`);
  }
  return found;
};

const queueRoot = (): HTMLElement => {
  const found = document.querySelector<HTMLElement>('[data-queue]');
  if (found === null) {
    throw new Error('the Queue is not on screen');
  }
  return found;
};

type LiveRowParams = {
  readonly runId: string;
  readonly sessionId: string;
};

const liveRowOf = ({ runId, sessionId }: LiveRowParams) => ({
  runId,
  sessionId,
  agentId: `implementer-${runId}`,
  mountId: null,
  workflowRunId: null,
  branch: null,
  startedAt: 1,
  quietMs: 0,
  tool: { name: 'Bash', command: 'pnpm test', path: null },
  hasToolCall: true,
  canSeeTools: true,
});

type OverlapMountParams = {
  readonly mountId: string;
  readonly sessionId: string;
  readonly paths: ReadonlyArray<string>;
};

const overlapMountOf = ({ mountId, sessionId, paths }: OverlapMountParams) => ({
  mountId,
  sessionId,
  projectId: 'project-ledger',
  branch: `hl/${mountId}`,
  createdAt: 1,
  port: null,
  hasFixedPort: false,
  paths,
});

const renderQueue = () =>
  render(
    <ToastProvider>
      <QueueBoard workspaceId={harborline.id} sessions={useAppStore.getState().sessions} />
    </ToastProvider>,
  );

type MoveParams = {
  readonly reason: SessionAttentionReason;
};

const moveOf = ({ reason }: MoveParams): QueueMove => ({
  id: `${asking.id}:${reason}`,
  sessionId: asking.id,
  reason,
  questionId: null,
  title: reason,
  since: null,
});

const questionOf = ({ sessionId }: SessionParams) =>
  openQuestionFor({ sessionId: brandId<SessionId>({ value: sessionId }) });

const seedTwoQuestions = () => {
  const first = questionOf({ sessionId: asking.id });
  const later = {
    ...first,
    id: brandId<OpenQuestionId>({ value: 'question-later' }),
    text: 'Should the retry cap be five?',
  };
  seedColumn({ store: useAppStore, sessions: [asking], questions: [asking] });
  useAppStore.setState((state) => ({
    sessionOpenQuestions: { ...state.sessionOpenQuestions, [asking.id]: [first, later] },
  }));
  return { first, later };
};

type RowButtonParams = {
  readonly name: string;
};

const notNowOf = ({ name }: RowButtonParams): HTMLElement =>
  within(screen.getByRole('region', { name: 'Needs you' })).getByRole('button', {
    name: `Not now: ${name}`,
  });

describe('the Queue', () => {
  it('says nothing waits, nothing runs and nothing is ready, without a count', () => {
    seedColumn({ store: useAppStore, sessions: [quiet], mounts: [[quiet, ledgerCore]] });
    renderQueue();
    const needsYou = screen.getByRole('region', { name: 'Needs you' });
    within(needsYou).getByText('Nothing waits on you.');
    expect(within(needsYou).queryByText('0')).toBeNull();
    const ready = screen.getByRole('region', { name: 'Ready to merge' });
    within(ready).getByText('Nothing to merge');
    expect(within(ready).queryByText('0')).toBeNull();
    within(screen.getByRole('region', { name: 'Running' })).getByText('Nothing is running');
  });

  it('puts the question that waits on you in Needs you as one row, with no card and no Open in session', () => {
    seedColumn({ store: useAppStore, sessions: [quiet, asking], questions: [asking] });
    renderQueue();
    const needsYou = screen.getByRole('region', { name: 'Needs you' });
    const question = openQuestionFor({ sessionId: asking.id });
    within(needsYou).getByRole('button', { name: question.text });
    expect(within(needsYou).queryByRole('button', { name: 'Open in session' })).toBeNull();
    expect(within(needsYou).queryByRole('textbox')).toBeNull();
    expect(within(needsYou).queryByText('Nothing waits on you.')).toBeNull();
  });

  it('draws every Move as the same row, the keyboard one on the selection surface', () => {
    seedColumn({ store: useAppStore, sessions: [asking, second], questions: [asking, second] });
    renderQueue();
    const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-queue] [data-row]'));
    const shapes = rows.map((row) =>
      Array.from(row.querySelectorAll('*'))
        .map((node) => node.tagName)
        .join(' '),
    );
    expect(shapes).toHaveLength(2);
    expect(new Set(shapes).size).toBe(1);
    expect(rows.map((row) => row.getAttribute('data-selected'))).toEqual(['true', 'false']);
  });

  it('opens the session where the Move waits when its row is clicked', () => {
    const navigate = vi.fn();
    seedColumn({ store: useAppStore, sessions: [asking, second], questions: [asking, second] });
    useAppStore.setState({ navigate });
    renderQueue();
    fireEvent.click(moveButton({ moveId: moveIdOf({ sessionId: second.id }) }));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({
      to: questionPlace({
        sessionId: second.id,
        questionId: questionOf({ sessionId: second.id }).id,
      }),
    });
  });

  it('opens the very question clicked when one session asks two', () => {
    const navigate = vi.fn();
    const { later } = seedTwoQuestions();
    useAppStore.setState({ navigate });
    renderQueue();
    fireEvent.click(moveButton({ moveId: `${asking.id}:question:${later.id}` }));
    expect(navigate).toHaveBeenCalledWith({
      to: questionPlace({ sessionId: asking.id, questionId: later.id }),
    });
  });

  it('acts on the row Tab reached: S puts it off and the arrow opens it', async () => {
    const navigate = vi.fn();
    const { first, later } = seedTwoQuestions();
    useAppStore.setState({ navigate });
    renderQueue();
    const laterRow = moveButton({ moveId: `${asking.id}:question:${later.id}` });
    fireEvent.focusIn(laterRow);
    fireEvent.keyDown(laterRow, { key: 'ArrowRight' });
    expect(navigate).toHaveBeenLastCalledWith({
      to: questionPlace({ sessionId: asking.id, questionId: later.id }),
    });
    const laterNotNow = notNowOf({ name: later.text });
    fireEvent.focusIn(laterNotNow);
    fireEvent.keyDown(laterNotNow, { key: 's' });
    const needsYou = screen.getByRole('region', { name: 'Needs you' });
    await waitFor(() =>
      expect(within(needsYou).queryByRole('button', { name: later.text })).toBeNull(),
    );
    within(needsYou).getByRole('button', { name: first.text });
  });

  it('opens the keyboard row with Enter and moves to the next one with J', () => {
    const navigate = vi.fn();
    seedColumn({ store: useAppStore, sessions: [asking, second], questions: [asking, second] });
    useAppStore.setState({ navigate });
    renderQueue();
    fireEvent.keyDown(queueRoot(), { key: 'j' });
    fireEvent.keyDown(queueRoot(), { key: 'Enter' });
    expect(navigate).toHaveBeenLastCalledWith({
      to: questionPlace({
        sessionId: second.id,
        questionId: questionOf({ sessionId: second.id }).id,
      }),
    });
  });

  it('puts a Move off from its row with Not now, and Undo brings it back', async () => {
    seedColumn({ store: useAppStore, sessions: [asking], questions: [asking] });
    renderQueue();
    const needsYou = screen.getByRole('region', { name: 'Needs you' });
    const question = openQuestionFor({ sessionId: asking.id });
    fireEvent.click(within(needsYou).getByRole('button', { name: `Not now: ${question.text}` }));
    await waitFor(() =>
      expect(within(needsYou).queryByRole('button', { name: question.text })).toBeNull(),
    );
    await act(async () => {
      await useAppStore.getState().undoLastOperation();
    });
    await within(needsYou).findByRole('button', { name: question.text }, WAIT);
  });

  it('puts the keyboard Move off with S, and Undo brings it back', async () => {
    seedColumn({ store: useAppStore, sessions: [asking], questions: [asking] });
    renderQueue();
    const needsYou = screen.getByRole('region', { name: 'Needs you' });
    const question = openQuestionFor({ sessionId: asking.id });
    fireEvent.keyDown(queueRoot(), { key: 's' });
    await waitFor(() =>
      expect(within(needsYou).queryByRole('button', { name: question.text })).toBeNull(),
    );
    within(needsYou).getByRole('button', { name: 'Show 1 hidden' });
    await act(async () => {
      await useAppStore.getState().undoLastOperation();
    });
    await within(needsYou).findByRole('button', { name: question.text }, WAIT);
  });

  it('passes the keys to the next band with F6', () => {
    seedColumn({ store: useAppStore, sessions: [asking, second], questions: [asking, second] });
    renderQueue();
    fireEvent.keyDown(queueRoot(), { key: 'F6' });
    expect(queueRoot().getAttribute('data-active-band')).toBe('running');
    expect(document.activeElement?.getAttribute('data-queue-band')).toBe('running');
    expect(
      Array.from(document.querySelectorAll('[data-queue] [data-row]')).some(
        (row) => row.getAttribute('data-selected') === 'true',
      ),
    ).toBe(false);
  });

  it('moves the Running focus to the agent whose peek was opened', async () => {
    seedColumn({ store: useAppStore, sessions: [asking, second] });
    stubStoryInvoke({
      live_work: [
        liveRowOf({ runId: 'run-1', sessionId: asking.id }),
        liveRowOf({ runId: 'run-2', sessionId: second.id }),
      ],
    });
    renderQueue();
    const target = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-running-row="run-2"]');
      expect(found).not.toBeNull();
      return found;
    }, WAIT);
    if (target === null) {
      throw new Error('the second agent is not running');
    }
    fireEvent.click(target);
    await waitFor(() =>
      expect(
        document.querySelector('[data-running-row="run-2"]')?.getAttribute('aria-current'),
      ).toBe('true'),
    );
    expect(
      document.querySelector('[data-running-row="run-1"]')?.getAttribute('aria-current'),
    ).toBeNull();
  });

  it('puts one overlap chip on the running row of the session that waits', async () => {
    seedColumn({ store: useAppStore, sessions: [asking, second] });
    stubStoryInvoke({
      live_work: [
        { ...liveRowOf({ runId: 'run-1', sessionId: asking.id }), mountId: 'mount-small' },
        { ...liveRowOf({ runId: 'run-2', sessionId: second.id }), mountId: 'mount-large' },
        { ...liveRowOf({ runId: 'run-3', sessionId: second.id }), mountId: 'mount-large' },
      ],
      overlap_read: [
        overlapMountOf({
          mountId: 'mount-small',
          sessionId: asking.id,
          paths: ['src/retry/state.ts'],
        }),
        overlapMountOf({
          mountId: 'mount-large',
          sessionId: second.id,
          paths: ['src/retry/state.ts', 'src/batch/a.ts', 'src/batch/b.ts'],
        }),
      ],
    });
    renderQueue();

    const chip = await screen.findByRole('button', { name: /^Overlaps/ }, WAIT);

    expect(screen.getAllByRole('button', { name: /^Overlaps/ })).toHaveLength(1);
    const row = chip.closest('[data-row]')?.querySelector('[data-running-row]');
    expect(row?.getAttribute('data-running-row')).toBe('run-2');
  });

  describe('Ready to merge', () => {
    const smaller = sessionOf({ goal: 'Retry budget for webhooks' });
    const larger = sessionOf({ goal: 'Ledger rounding' });

    const seedReady = () => {
      seedColumn({
        store: useAppStore,
        sessions: [larger, smaller],
        mounts: [
          [larger, ledgerCore],
          [smaller, notifyRelay],
        ],
      });
      const approved = { reviewDecision: 'approved' as const };
      const githubOf = ({
        session,
        number,
      }: {
        readonly session: Session;
        readonly number: number;
      }) => {
        const mount = mountOf({ session, project: session === larger ? ledgerCore : notifyRelay });
        const base = mountGithubOf({ mount, number });
        return {
          mount,
          github: { ...base, pr: base.pr === null ? null : { ...base.pr, ...approved } },
        };
      };
      const one = githubOf({ session: larger, number: 418 });
      const two = githubOf({ session: smaller, number: 76 });
      useAppStore.setState({
        mountGithub: { [one.mount.mountId]: one.github, [two.mount.mountId]: two.github },
        sessionGithub: {
          [larger.id]: { ...mergedGithub(), pr: one.github.pr },
          [smaller.id]: { ...mergedGithub(), pr: two.github.pr },
        },
      });
      return { one, two };
    };

    const readyBand = () => screen.getByRole('region', { name: 'Ready to merge' });

    it('merges nothing until you mark rows and press the button', async () => {
      const merges = vi.fn(async () => undefined);
      seedReady();
      useAppStore.setState({ mergePr: merges });
      renderQueue();
      const band = readyBand();
      await waitFor(() => expect(band.querySelectorAll('[data-ready-row]')).toHaveLength(2), WAIT);
      const button = within(band).getByRole('button', { name: 'Merge in order' });
      expect(button).toHaveProperty('disabled', true);
      fireEvent.keyDown(queueRoot(), { key: 'F6' });
      fireEvent.keyDown(queueRoot(), { key: 'F6' });
      fireEvent.keyDown(queueRoot(), { key: 'm' });
      expect(useAppStore.getState().mergeTrain).toBeNull();
      expect(merges).not.toHaveBeenCalled();
    });

    it('marks with Space, names the method and starts the train with M', async () => {
      const start = vi.fn(async (_params: StartMergeTrainParams) => ({
        kind: 'done' as const,
        merged: 2,
      }));
      seedReady();
      useAppStore.setState({ startMergeTrain: start });
      renderQueue();
      const band = readyBand();
      await waitFor(() => expect(band.querySelectorAll('[data-ready-row]')).toHaveLength(2), WAIT);
      expect(
        Array.from(band.querySelectorAll('[data-ready-reason]')).map((node) => node.textContent),
      ).toEqual(['First: waiting longest']);
      fireEvent.keyDown(queueRoot(), { key: 'F6' });
      fireEvent.keyDown(queueRoot(), { key: 'F6' });
      expect(queueRoot().getAttribute('data-active-band')).toBe('ready');
      fireEvent.keyDown(queueRoot(), { key: ' ' });
      fireEvent.keyDown(queueRoot(), { key: 'j' });
      fireEvent.keyDown(queueRoot(), { key: ' ' });
      within(band).getByRole('button', { name: 'Merge 2 in order' });
      fireEvent.keyDown(queueRoot(), { key: 'M' });
      expect(start).toHaveBeenCalledOnce();
      expect(start.mock.calls[0]?.[0]).toMatchObject({ method: 'squash' });
    });

    it('drops a mark when the row now points at another pull request', async () => {
      const start = vi.fn(async (_params: StartMergeTrainParams) => ({
        kind: 'done' as const,
        merged: 1,
      }));
      const { two } = seedReady();
      useAppStore.setState({ startMergeTrain: start });
      renderQueue();
      const band = readyBand();
      await waitFor(() => expect(band.querySelectorAll('[data-ready-row]')).toHaveLength(2), WAIT);
      fireEvent.click(within(band).getByRole('checkbox', { name: '#76' }));
      expect(within(band).getByRole('checkbox', { name: '#76' }).getAttribute('aria-checked')).toBe(
        'true',
      );
      const moved = two.github.pr === null ? null : { ...two.github.pr, number: 77 };
      act(() => {
        useAppStore.setState((state) => ({
          mountGithub: { ...state.mountGithub, [two.mount.mountId]: { ...two.github, pr: moved } },
          sessionGithub: {
            ...state.sessionGithub,
            [smaller.id]: { ...mergedGithub(), pr: moved },
          },
        }));
      });
      await waitFor(() => within(band).getByRole('checkbox', { name: '#77' }), WAIT);
      expect(within(band).getByRole('checkbox', { name: '#77' }).getAttribute('aria-checked')).toBe(
        'false',
      );
      expect(within(band).getByRole('button', { name: 'Merge in order' })).toHaveProperty(
        'disabled',
        true,
      );
      fireEvent.keyDown(queueRoot(), { key: 'F6' });
      fireEvent.keyDown(queueRoot(), { key: 'F6' });
      fireEvent.keyDown(queueRoot(), { key: 'M' });
      expect(start).not.toHaveBeenCalled();
    });

    it('picks the mount whose pull request is the one the row shows when two share its number', async () => {
      const start = vi.fn(async (_params: StartMergeTrainParams) => ({
        kind: 'done' as const,
        merged: 1,
      }));
      const { two } = seedReady();
      const other = mountOf({ session: smaller, project: ledgerCore });
      const otherBase = mountGithubOf({ mount: other, number: 76 });
      useAppStore.setState((state) => ({
        startMergeTrain: start,
        sessionProjectMounts: { ...state.sessionProjectMounts, [smaller.id]: [other, two.mount] },
        mountGithub: {
          ...state.mountGithub,
          [other.mountId]: {
            ...otherBase,
            pr:
              otherBase.pr === null
                ? null
                : {
                    ...otherBase.pr,
                    reviewDecision: 'approved',
                    url: 'https://github.com/acme/ledger-core/pull/76',
                  },
          },
        },
      }));
      renderQueue();
      const band = readyBand();
      await waitFor(() => within(band).getByRole('checkbox', { name: '#76' }), WAIT);
      fireEvent.click(within(band).getByRole('checkbox', { name: '#76' }));
      fireEvent.keyDown(queueRoot(), { key: 'F6' });
      fireEvent.keyDown(queueRoot(), { key: 'F6' });
      fireEvent.keyDown(queueRoot(), { key: 'M' });
      expect(start.mock.calls[0]?.[0].cars).toEqual([
        expect.objectContaining({ prNumber: 76, mountId: two.mount.mountId }),
      ]);
    });

    it('stops after this one from the strip and shows each step as one line', async () => {
      seedReady();
      useAppStore.setState({
        mergeTrain: {
          id: 'train-1',
          cars: [
            {
              sessionId: smaller.id,
              mountId: mountOf({ session: smaller, project: notifyRelay }).mountId,
              prNumber: 76,
              repo: 'notify-relay',
              base: 'main',
            },
            {
              sessionId: larger.id,
              mountId: mountOf({ session: larger, project: ledgerCore }).mountId,
              prNumber: 418,
              repo: 'ledger-core',
              base: 'main',
            },
          ],
          method: 'squash',
          index: 0,
          step: 'merging',
          hasUpdated: false,
          merged: 0,
          isStopRequested: false,
          outcome: null,
        },
      });
      renderQueue();
      const band = readyBand();
      within(band).getByText('Merging 1 of 2 · #76 notify-relay');
      fireEvent.click(within(band).getByRole('button', { name: 'Stop after this one' }));
      expect(useAppStore.getState().mergeTrain?.isStopRequested).toBe(true);
      expect(within(band).getByRole('button', { name: 'Stop after this one' })).toHaveProperty(
        'disabled',
        true,
      );
    });
  });

  it.each(['open-question', 'needs-approval', 'plan-approval'] as const)(
    'opens the overview with the Move on top for %s, never the desk',
    (reason) => {
      seedColumn({ store: useAppStore, sessions: [asking] });
      expect(queueLandingOf({ state: useAppStore.getState(), move: moveOf({ reason }) })).toEqual(
        sessionPlace({ sessionId: asking.id }),
      );
    },
  );

  it.each(['ci-failed', 'changes-requested', 'fix-needs-you'] as const)(
    'opens %s where the Move acts',
    (reason) => {
      seedColumn({ store: useAppStore, sessions: [asking] });
      const state = useAppStore.getState();
      expect(queueLandingOf({ state, move: moveOf({ reason }) })).toEqual(
        attentionPlace({ state, sessionId: asking.id, reason }),
      );
    },
  );
});
