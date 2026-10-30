// @vitest-environment happy-dom
vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 18, 10, 31, 0));
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { EMPTY_DURATION_HISTORY, type DurationHistory, type DurationSample } from '@goodboy/core';
import { brandId, type IsoDateTime } from '@goodboy/types';
import { ToastProvider } from '../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../store/runtime/worktreeStatuses/cache';
import { AutoReleaseContext } from '../../auto/autoReleaseContext';
import {
  COLUMN_SESSION_ID,
  seedCentralColumn,
  type ColumnKind,
} from '../../../app/components/MockScene/scenes/u26/centralColumnSeed';

let useAppStore: Awaited<ReturnType<typeof importStore>>;
let SessionOverviewPane: typeof import('../components/SessionOverviewPane').SessionOverviewPane;

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore = await importStore();
  ({ SessionOverviewPane } = await import('../components/SessionOverviewPane'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(cleanup);

afterAll(() => {
  vi.useRealTimers();
});

type ShowParams = {
  readonly kind: ColumnKind;
};

const mountedSession = () => {
  const session = useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === COLUMN_SESSION_ID);
  if (session === undefined) {
    throw new Error('The seed must hold the session');
  }
  return session;
};

const settle = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const mountPane = async () => {
  render(
    <ToastProvider>
      <AutoReleaseContext.Provider value>
        <SessionOverviewPane session={mountedSession()} />
      </AutoReleaseContext.Provider>
    </ToastProvider>,
  );
  await settle();
};

const show = async ({ kind }: ShowParams) => {
  seedCentralColumn({ kind });
  await mountPane();
};

type CardParams = {
  readonly name: string;
};

const cardOf = ({ name }: CardParams) => screen.getByRole('region', { name });

const runRow = ({ title }: { readonly title: string }) =>
  within(cardOf({ name: 'Running' })).getByRole('region', { name: `Workflow: ${title}` });

const SAMPLE_ROLES = ['custom', 'implementer', 'reviewer', 'scout', 'tester', 'planner'] as const;
const SAMPLE_MINUTES = [6, 8, 10, 12, 14, 8, 10, 12, 9] as const;
const MINUTE_MS = 60_000;

type SampleParams = {
  readonly role: (typeof SAMPLE_ROLES)[number];
  readonly minutes: number;
};

const sampleOf = ({ role, minutes }: SampleParams): DurationSample => ({
  role,
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: null,
  activeMs: minutes * MINUTE_MS,
  costUsd: 1,
  endedAtMs: Date.now() - MINUTE_MS,
});

const usualTimes = (): DurationHistory => ({
  ...EMPTY_DURATION_HISTORY,
  steps: SAMPLE_ROLES.flatMap((role) =>
    SAMPLE_MINUTES.map((minutes) => sampleOf({ role, minutes })),
  ),
});

describe('the parity list of the Overview, walked on the cards', () => {
  it('1: a stuck agent is reachable from Running, with its state and the way to open it', async () => {
    await show({ kind: 'stuck' });

    const auto = within(cardOf({ name: 'Running' })).getByRole('region', {
      name: /^Auto agent: Harden retries/,
    });
    expect(auto.getAttribute('data-state')).toBe('stuck');
    expect(auto.textContent).toContain('Stuck');
    expect(auto.textContent).toContain('Never started');
    within(auto).getByRole('button', { name: 'Open Auto chat' });
  });

  it('1: an agent that timed out stays in Running and asks in Needs you', async () => {
    await show({ kind: 'failed' });

    expect(cardOf({ name: 'Running' }).textContent).toContain('Stuck');
    expect(cardOf({ name: 'Needs you' }).textContent).toContain('Auto is stuck');
  });

  it('1: a child that declared itself blocked says Blocked on the Auto row', async () => {
    await show({ kind: 'blocked' });

    expect(cardOf({ name: 'Running' }).textContent).toContain('Blocked');
  });

  it('2: the Needs you ask keeps its group, its sentence and the button that opens it', async () => {
    await show({ kind: 'stuck' });
    const navigate = vi.fn();
    act(() => {
      useAppStore.setState({ navigate });
    });

    const needsYou = cardOf({ name: 'Needs you' });
    expect(needsYou.textContent).toContain('Fix');
    expect(needsYou.textContent).toContain('Auto is stuck');
    fireEvent.click(within(needsYou).getByRole('button', { name: 'Open Auto' }));

    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('2: the permission ask of one agent sits in Needs you with one filled button in the column', async () => {
    await show({ kind: 'agent' });

    expect(cardOf({ name: 'Needs you' }).querySelectorAll('[data-action-card]').length).toBe(1);
    expect(
      document.querySelectorAll('[data-central-column] [data-variant="primary"]'),
    ).toHaveLength(1);
  });

  it('3: a workflow run shows the step it stands at with its number and its steps as a bar', async () => {
    await show({ kind: 'mid' });

    const run = runRow({ title: 'Build' });
    expect(run.textContent).toContain('Step 3 of 6');
    expect(run.querySelectorAll('[data-step-state]')).toHaveLength(6);
  });

  it('3: an orchestrated run numbers its steps and says the next one is not decided yet', async () => {
    await show({ kind: 'orchestrated' });

    const run = runRow({ title: 'Payout limits' });
    expect(run.textContent).toContain('Step 3 of 3');
    expect(run.textContent).toContain('Next step, not decided yet');
  });

  it('3: finished steps count in the Done line with the Full log beside it', async () => {
    await show({ kind: 'finished' });

    const done = cardOf({ name: 'Done' });
    expect(done.querySelector('[data-done-line]')?.textContent).toBe(
      '5 finished runs and agents are in the full log.',
    );
    within(done).getByRole('button', { name: 'Full log' });
  });

  it('4: a running run with a usual time shows the time left on its row', async () => {
    seedCentralColumn({ kind: 'mid' });
    act(() => {
      useAppStore.setState({
        sessionOpenQuestions: { [COLUMN_SESSION_ID]: [] },
        workspaceDurationHistory: { [mountedSession().workspaceId]: usualTimes() },
        loadWorkspaceDurationHistory: async () => undefined,
      });
    });
    await mountPane();

    expect(runRow({ title: 'Build' }).textContent).toMatch(/left/);
  });

  it('4: a run without history shows the time it has taken and no promise', async () => {
    await show({ kind: 'mid' });

    const run = runRow({ title: 'Build' });
    expect(run.textContent).not.toMatch(/left/);
    expect(run.textContent).toMatch(/\d+m/);
  });

  it('5: the stuck Auto line offers Answer and Stop, and Retry sits once in Needs you', async () => {
    await show({ kind: 'stuck' });

    const line = document.querySelector<HTMLElement>('[data-now-actions]');
    if (line === null) {
      throw new Error('The stuck line must be drawn');
    }
    const actions = within(line);
    expect(actions.queryByRole('button', { name: /^Retry "/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Retry "/ })).toHaveLength(1);
    within(cardOf({ name: 'Needs you' })).getByRole('button', { name: /^Retry "/ });
    actions.getByRole('button', { name: 'Answer Auto in its chat' });
    actions.getByRole('button', { name: 'Stop Auto and its agents' });
  });

  it('6: an archived session keeps the Done card and its Full log, nothing else', async () => {
    seedCentralColumn({ kind: 'mid' });
    act(() => {
      useAppStore.setState((state) => ({
        sessions: state.sessions.map((session) => ({
          ...session,
          archivedAt: brandId<IsoDateTime>({ value: '2026-10-18T10:00:00.000Z' }),
        })),
      }));
    });
    await mountPane();

    const ids = [...document.querySelectorAll('[data-overview-card]')].map((card) =>
      card.getAttribute('data-overview-card'),
    );
    expect(ids).toEqual(['done']);
    screen.getByRole('button', { name: 'Full log' });
  });
});
