// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  MountId,
  OpenQuestion,
  OpenQuestionId,
  ProjectId,
  SessionProjectMount,
} from '@goodboy/types';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { useAppStore } from '../../../../../store';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { mockSceneIpc } from '../mockSceneIpc';
import { U25_C08_PRESET_RUN_SCENES } from './c08-preset-run';
import { C08_IMPLEMENTER_ID, C08_REVIEWER_ID, C08_RUN_ID, C08_SESSION_ID } from './c08RunSeed';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U25_C08_PRESET_RUN_SCENES;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U25_C08_PRESET_RUN_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await settle();
};

const press = async (element: HTMLElement): Promise<void> => {
  fireEvent.click(element);
  await settle();
};

const nodeOf = (selector: string): HTMLElement => {
  const node = document.querySelector<HTMLElement>(selector);
  if (node === null) {
    throw new Error(`nothing matches ${selector}`);
  }
  return node;
};

type Internals = {
  invoke: (command: string, args?: unknown) => unknown;
};

const isInternals = (value: unknown): value is Internals =>
  typeof value === 'object' &&
  value !== null &&
  'invoke' in value &&
  typeof value.invoke === 'function';

type FailParams = {
  readonly marker: string;
};

const failWritesWith = ({ marker }: FailParams): { readonly heal: () => void } => {
  const internals: unknown = Reflect.get(window, '__TAURI_INTERNALS__');
  if (!isInternals(internals)) {
    throw new Error('no scene IPC installed');
  }
  const original = internals.invoke;
  let isFailing = true;
  internals.invoke = (command, args) => {
    if (isFailing && command === 'db_execute' && JSON.stringify(args).includes(marker)) {
      return Promise.reject(new Error('database is locked'));
    }
    return original(command, args);
  };
  return {
    heal: () => {
      isFailing = false;
    },
  };
};

const runLevel = () => within(nodeOf('[data-spawned-panel="run"]'));

const tail = () => within(nodeOf('[data-run-tail]'));

const header = () => within(nodeOf('[data-run-header-actions]'));

type AgentPatch = {
  readonly id: AgentId;
  readonly patch: Partial<Agent>;
};

const patchAgent = ({ id, patch }: AgentPatch): void => {
  act(() => {
    useAppStore.setState((state) => ({
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [C08_SESSION_ID]: (state.sessionPhaseRuns[C08_SESSION_ID] ?? []).map((agent) =>
          agent.id === id ? { ...agent, ...patch } : agent,
        ),
      },
    }));
  });
};

type RunPatch = {
  readonly patch: Record<string, unknown>;
};

const patchRun = ({ patch }: RunPatch): void => {
  act(() => {
    useAppStore.setState((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === C08_SESSION_ID
          ? {
              ...session,
              workflowRuns: session.workflowRuns.map((run) =>
                run.id === C08_RUN_ID ? { ...run, ...patch } : run,
              ),
            }
          : session,
      ),
    }));
  });
};

const menuOrder = ['Skip step 2', 'Copy run summary', 'Stop run', 'Archive run', 'Delete run'];

const openMenu = async (): Promise<HTMLElement> => {
  await press(screen.getByRole('button', { name: /run actions$/ }));
  return screen.getByRole('menu');
};

type MountParams = {
  readonly index: number;
};

const projectIdOf = ({ index }: MountParams): ProjectId =>
  JSON.parse(`"mock-c08-project-${index}"`);

const mountIdOf = ({ index }: MountParams): MountId => JSON.parse(`"mock-c08-mount-${index}"`);

const mountOf = ({ index }: MountParams): SessionProjectMount => ({
  projectId: projectIdOf({ index }),
  mountName: index === 0 ? 'payments-api' : 'ledger-core',
  worktreePath: `/mock/harborline/${index === 0 ? 'payments-api' : 'ledger-core'}`,
  repoRoot: `/mock/harborline/${index === 0 ? 'payments-api' : 'ledger-core'}-source`,
  branch: 'mara/ledger-export',
  mountId: mountIdOf({ index }),
  sessionId: C08_SESSION_ID,
  lastWorktreePath: null,
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
});

const QUESTION_ID: OpenQuestionId = JSON.parse('"mock-c08-question"');

const QUESTION: OpenQuestion = {
  id: QUESTION_ID,
  sessionId: C08_SESSION_ID,
  workflowRunId: C08_RUN_ID,
  createdByAgentId: C08_IMPLEMENTER_ID,
  text: 'Should I also freeze the clock in the CSV snapshot tests?',
  suggestedAnswers: ['No, leave them', 'Yes, freeze it too'],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: JSON.parse('"2026-10-16T15:05:00.000Z"'),
};

describe('run rows stay reachable from the preset run level', () => {
  it('Runs list: a group carries its count from two rows', async () => {
    await mount('c08-runs');
    const grid = within(screen.getByRole('list', { name: 'Runs' }));
    const countOf = (label: string) =>
      grid.getByRole('heading', { name: label }).nextElementSibling?.textContent;
    expect(countOf('In progress')).toBe('2');
    expect(countOf('Finished')).toBeUndefined();
    expect(countOf('Archived')).toBeUndefined();
    expect(document.querySelector('[data-slot="pane-meta"]')).toBeNull();
  });

  it('Queued manual run: the list says it waits, its one header primary starts it', async () => {
    await mount('c08-runs');
    await press(screen.getByRole('button', { name: /^Open Document the export batching/ }));
    expect(tail().getByText('Waits to start')).toBeDefined();
    expect(header().getByRole('button', { name: 'Start run' })).toBeDefined();
    expect(tail().queryByRole('button', { name: 'Start run' })).toBeNull();
  });

  it('Archived runs fold in the list and restore from their header', async () => {
    await mount('c08-runs');
    await press(screen.getByRole('button', { name: 'Show' }));
    await press(screen.getByRole('button', { name: /^Open First try at the flaky export tests/ }));
    expect(screen.getByRole('button', { name: 'Restore' })).toBeDefined();
  });

  it('Run name edit: the identity row renames inline', async () => {
    await mount('c08-run-overview');
    await press(runLevel().getByRole('button', { name: 'Fix flaky tests in the ledger export' }));
    expect(runLevel().getByRole('textbox', { name: 'Run name' })).toBeDefined();
  });

  it('Pause run is the one header button; Stop run with its confirm and Skip step N sit in the run menu', async () => {
    await mount('c08-run-working');
    const live = within(
      document.querySelector<HTMLElement>('[data-run-live-verbs]') ?? document.body,
    );
    expect(live.getByRole('button', { name: 'Pause run' })).toBeDefined();
    expect(live.queryByRole('button', { name: 'Stop run' })).toBeNull();
    const menu = within(await openMenu());
    expect(menu.queryByText('Pause run')).toBeNull();
    expect(
      menu.getAllByRole('menuitem').map((item) => item.textContent?.replace(/…$/, '')),
    ).toEqual(menuOrder);
    await press(menu.getByRole('menuitem', { name: /^Stop run/ }));
    expect(screen.getByText('Stop this run?')).toBeDefined();
  });

  it('Pause run in the header: a failed write keeps the run live, and pressing again pauses it', async () => {
    mockSceneIpc(() => null);
    await mount('c08-run-working');
    const live = () =>
      within(document.querySelector<HTMLElement>('[data-run-live-verbs]') ?? document.body);
    const runStop = () =>
      (
        useAppStore.getState().sessions.find((session) => session.id === C08_SESSION_ID)
          ?.workflowRuns ?? []
      ).find((run) => run.id === C08_RUN_ID)?.orchestrationStop;
    const writes = failWritesWith({ marker: 'orchestration_stop_kind' });

    await press(live().getByRole('button', { name: 'Pause run' }));
    expect(runStop()).toBeUndefined();
    expect(live().getByRole('button', { name: 'Pause run' })).toBeDefined();

    writes.heal();
    await press(live().getByRole('button', { name: 'Pause run' }));
    expect(runStop()?.kind).toBe('paused');
    expect(document.querySelector('[data-run-verb="workflowRun.pause"]')).toBeNull();
    expect(live().getByRole('button', { name: 'Resume run' })).toBeDefined();
  });

  it('Resume run takes the place of Pause run: a failed write keeps it paused, pressing again resumes', async () => {
    mockSceneIpc(() => null);
    await mount('c08-run-working');
    const live = () =>
      within(document.querySelector<HTMLElement>('[data-run-live-verbs]') ?? document.body);
    const runStop = () =>
      (
        useAppStore.getState().sessions.find((session) => session.id === C08_SESSION_ID)
          ?.workflowRuns ?? []
      ).find((run) => run.id === C08_RUN_ID)?.orchestrationStop;
    await press(live().getByRole('button', { name: 'Pause run' }));
    expect(runStop()?.kind).toBe('paused');
    const verbs = () =>
      Array.from(document.querySelectorAll('[data-run-live-verbs] [data-run-verb]')).map((verb) =>
        verb.getAttribute('data-run-verb'),
      );
    expect(verbs()).toEqual(['workflowRun.resume']);
    const writes = failWritesWith({ marker: 'orchestration_stop_kind' });

    await press(live().getByRole('button', { name: 'Resume run' }));
    expect(runStop()?.kind).toBe('paused');
    expect(live().getByRole('button', { name: 'Resume run' })).toBeDefined();

    writes.heal();
    await press(live().getByRole('button', { name: 'Resume run' }));
    expect(runStop() ?? null).toBeNull();
    expect(verbs()).toEqual(['workflowRun.pause']);
  });

  it('Continue step after an interrupted step, on the tail', async () => {
    await mount('c08-run-working');
    patchAgent({ id: C08_IMPLEMENTER_ID, patch: { status: 'stopped' } });
    await settle();
    expect(tail().getByRole('button', { name: 'Continue step' })).toBeDefined();
  });

  it('Resume all after a restart, on the tail', async () => {
    await mount('c08-run-working');
    patchAgent({ id: C08_IMPLEMENTER_ID, patch: { status: 'stopped', stoppedBy: 'app' } });
    await settle();
    expect(tail().getByText('1 agent stopped when Goodboy closed')).toBeDefined();
    expect(tail().getByRole('button', { name: 'Resume' })).toBeDefined();
  });

  it('Pause run and Resume: the tail says the run is paused, Resume run lives only in the header', async () => {
    await mount('c08-run-ready');
    patchRun({ patch: { orchestrationStop: { kind: 'paused', message: 'Paused by you.' } } });
    await settle();
    expect(tail().getByText('Paused by you')).toBeDefined();
    expect(tail().queryByRole('button', { name: 'Resume' })).toBeNull();
    const live = within(nodeOf('[data-run-live-verbs]'));
    expect(live.getByRole('button', { name: 'Resume run' })).toBeDefined();
  });

  it('Next step: Start step 3 is the header primary once step 2 is done', async () => {
    await mount('c08-run-ready');
    expect(header().getByRole('button', { name: 'Start step 3' })).toBeDefined();
    expect(tail().queryByRole('button', { name: 'Start step 3' })).toBeNull();
  });

  it('Sub agents sit under their step in the Agents panel', async () => {
    await mount('c08-run-working');
    act(() => {
      useAppStore.setState((state) => ({
        sessionPhaseRuns: {
          ...state.sessionPhaseRuns,
          [C08_SESSION_ID]: [
            ...(state.sessionPhaseRuns[C08_SESSION_ID] ?? []),
            {
              id: JSON.parse('"mock-c08-sub-scout"'),
              sessionId: C08_SESSION_ID,
              parentAgentId: C08_IMPLEMENTER_ID,
              ordinal: 9,
              name: 'Map the batch writer',
              kind: 'scout',
              status: 'running',
            },
          ],
        },
      }));
    });
    await settle();
    expect(runLevel().getByText('Map the batch writer')).toBeDefined();
  });

  it('Skipped and Blocked step words show in the Agents panel', async () => {
    await mount('c08-run-ready');
    patchAgent({ id: C08_REVIEWER_ID, patch: { status: 'skipped' } });
    await settle();
    expect(runLevel().getAllByRole('img', { name: 'Skipped' }).length).toBeGreaterThan(0);
  });

  it('Add step to a live or finished run opens the draft in the center', async () => {
    await mount('c08-run-add-step');
    expect(within(nodeOf('[data-run-overview]')).getByLabelText('Edit step 4')).toBeDefined();
  });

  it('Write destination with 2 writable worktrees shows on the run Overview', async () => {
    await mount('c08-run-overview');
    act(() => {
      useAppStore.setState({
        sessionProjectMounts: { [C08_SESSION_ID]: [mountOf({ index: 0 }), mountOf({ index: 1 })] },
      });
    });
    await settle();
    expect(nodeOf('[data-run-overview]').textContent).toMatch(/payments-api|ledger-core/);
  });

  it('Run goal on the Overview, and report and wireframe once finished', async () => {
    await mount('c08-run-done');
    expect(screen.getByText(/fail one run in five on CI/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create report' })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Create wireframe/ })).toBeDefined();
  });

  it('Plan approval is the header primary', async () => {
    await mount('c08-run-approval');
    expect(header().getByRole('button', { name: 'Approve plan' })).toBeDefined();
  });

  it('Answer a step question from the header', async () => {
    await mount('c08-run-ready');
    act(() => {
      useAppStore.setState({ sessionOpenQuestions: { [C08_SESSION_ID]: [QUESTION] } });
    });
    await settle();
    expect(header().getByRole('button', { name: 'Answer' })).toBeDefined();
    expect(tail().queryByRole('button', { name: 'Answer' })).toBeNull();
  });

  it('Step model sits in the step footer of the embedded conversation', async () => {
    await mount('c08-run-working-other');
    expect(nodeOf('[data-preset-run]').textContent).toMatch(/Sonnet 5\.5/);
  });
});
