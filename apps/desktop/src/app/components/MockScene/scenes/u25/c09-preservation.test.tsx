// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Agent, AgentId, MountId, ProjectId, SessionProjectMount } from '@goodboy/types';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { useAppStore } from '../../../../../store';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U25_C09_ORCHESTRATED_SCENES } from './c09-orchestrated';
import { C09_RUN_ID, C09_SESSION_ID, C09_TESTER_ID } from './c09OrchestratedSeed';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U25_C09_ORCHESTRATED_SCENES;

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
  const Scene = U25_C09_ORCHESTRATED_SCENES[name];
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

const tail = () => within(nodeOf('[data-orchestrated-tail]'));

const checklist = () => within(nodeOf('section[aria-label="Plan and progress"]'));

const openMenu = async (): Promise<HTMLElement> => {
  await press(screen.getByRole('button', { name: /run actions$/ }));
  return screen.getByRole('menu');
};

type AgentPatch = {
  readonly id: AgentId;
  readonly patch: Partial<Agent>;
};

const patchAgent = ({ id, patch }: AgentPatch): void => {
  act(() => {
    useAppStore.setState((state) => ({
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [C09_SESSION_ID]: (state.sessionPhaseRuns[C09_SESSION_ID] ?? []).map((agent) =>
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
        session.id === C09_SESSION_ID
          ? {
              ...session,
              workflowRuns: session.workflowRuns.map((run) =>
                run.id === C09_RUN_ID ? { ...run, ...patch } : run,
              ),
            }
          : session,
      ),
    }));
  });
};

type MountParams = {
  readonly index: number;
};

const mountOf = ({ index }: MountParams): SessionProjectMount => {
  const name = index === 0 ? 'payments-api' : 'ledger-core';
  const projectId: ProjectId = JSON.parse(`"mock-c09-project-${index}"`);
  const mountId: MountId = JSON.parse(`"mock-c09-mount-${index}"`);
  return {
    projectId,
    mountName: name,
    worktreePath: `/mock/harborline/${name}`,
    repoRoot: `/mock/harborline/${name}-source`,
    branch: 'mara/ledger-export',
    mountId,
    sessionId: C09_SESSION_ID,
    lastWorktreePath: null,
    baseBranch: null,
    parallelIndex: 0,
    isAttached: true,
    diskState: 'present',
    revision: 0,
  };
};

describe('SPEC3 9.4 orchestrated rows stay reachable from the orchestrated document', () => {
  it('Orchestrated entry: its own list, the empty state starts an orchestration', async () => {
    await mount('c09-orchestrated-empty');
    expect(screen.getByRole('button', { name: 'Orchestrate' })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Orchestrated/ })).toBeDefined();
  });

  it('Run header: Pause run and Stop run confirmed; overflow: Step routing, View diff, Save as preset, Copy run summary, Archive, Delete', async () => {
    await mount('c09-orch-running');
    act(() => {
      useAppStore.setState({ sessionProjectMounts: { [C09_SESSION_ID]: [mountOf({ index: 0 })] } });
    });
    await settle();
    const live = within(
      document.querySelector<HTMLElement>('[data-run-live-verbs]') ?? document.body,
    );
    expect(live.getByRole('button', { name: 'Pause run' })).toBeDefined();
    const menu = within(await openMenu());
    expect(menu.queryByText('Pause run')).toBeNull();
    expect(menu.getByText('Step routing')).toBeDefined();
    expect(menu.getByText('View diff')).toBeDefined();
    expect(menu.getByText('Copy run summary')).toBeDefined();
    expect(menu.getByText('Archive run')).toBeDefined();
    expect(menu.getByText('Delete run')).toBeDefined();
    expect(menu.getByText('Save as preset')).toBeDefined();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await settle();
    await press(live.getByRole('button', { name: 'Stop run' }));
    expect(screen.getByText('Stop this run?')).toBeDefined();
  });

  it('Orchestrator state ladder: Stop step on the tail asks before it stops', async () => {
    await mount('c09-orch-running');
    await press(tail().getByRole('button', { name: 'Stop step 3' }));
    expect(screen.getByText('Stop Run the 12k export benchmark?')).toBeDefined();
  });

  it('Orchestrator model and effort: the routing pill sits in the composer', async () => {
    await mount('c09-orch-running');
    const composer = within(nodeOf('[data-orchestrated-composer]'));
    expect(composer.getByTestId('orchestrator-routing')).toBeDefined();
  });

  it('Hint composer: Queue and Send now, a queued hint with Remove, read hints on the list', async () => {
    await mount('c09-orch-running');
    const field = screen.getByPlaceholderText('Hint the orchestrator');
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: 'Keep the header row' } });
    await settle();
    expect(screen.getByTestId('orchestrator-hint-queue').textContent).toContain('Queue');
    expect(screen.getByTestId('orchestrator-hint-now').textContent).toContain('Send now');
    const queued = within(screen.getByRole('list', { name: 'Queued hints' }));
    expect(screen.getAllByText('Waits for the next decision')).toHaveLength(1);
    expect(queued.getByRole('button', { name: 'Remove' })).toBeDefined();
    expect(checklist().getByText('Your hint, read at step 3')).toBeDefined();
  });

  it('Hint states: Reading now cannot be removed', async () => {
    await mount('c09-orch-reading');
    const queued = within(screen.getByRole('list', { name: 'Queued hints' }));
    expect(queued.getByText('Reading now')).toBeDefined();
    expect(queued.getByRole('button', { name: 'Remove' }).hasAttribute('disabled')).toBe(true);
  });

  it('Read N queued on a finished run, Resume and read N queued after Stop step', async () => {
    await mount('c09-orch-done');
    patchRun({
      patch: {
        orchestratorHints: [
          { id: 'mock-c09-late', text: 'Add a row count', createdAt: '2026-10-16T15:11:00.000Z' },
        ],
      },
    });
    await settle();
    expect(tail().getByRole('button', { name: 'Read 1 queued' })).toBeDefined();
    patchRun({
      patch: {
        orchestrationOutcome: undefined,
        orchestrationStop: { kind: 'operator', message: 'Stopped by you.' },
      },
    });
    await settle();
    expect(tail().getByRole('button', { name: 'Resume and read 1 queued' })).toBeDefined();
  });

  it('Why each step: the latest reason under the tail, older ones in the step pane', async () => {
    await mount('c09-orch-step');
    expect(
      tail().getByText('Why: The batching must be proven on 12,000 rows before any CSV work.'),
    ).toBeDefined();
    expect(nodeOf('[data-step-reason]').textContent).toContain('proven on 12,000 rows');
  });

  it('The closing decision and the Recap with Done and Left sit in the result', async () => {
    await mount('c09-orch-done');
    const result = within(nodeOf('[data-orchestrated-result]'));
    expect(result.getByText(/Streaming to CSV is a separate change/)).toBeDefined();
    expect(result.getByRole('list', { name: 'Done' })).toBeDefined();
    expect(result.getByRole('list', { name: 'Left' })).toBeDefined();
  });

  it('Recap Left items join the checklist while the run lives', async () => {
    await mount('c09-orch-running');
    expect(checklist().getByText('Prove the batching on 12,000 rows')).toBeDefined();
  });

  it('Decide next step only on a ready tail, Retry on a failed decision', async () => {
    await mount('c09-orch-ready');
    expect(tail().getByRole('button', { name: 'Decide next step' })).toBeDefined();
    cleanup();
    await mount('c09-orch-failed');
    expect(tail().getByRole('button', { name: 'Retry' })).toBeDefined();
  });

  it('Step routing: the run menu opens the model per step panel', async () => {
    await mount('c09-orch-running');
    const menu = within(await openMenu());
    await press(menu.getByText('Step routing'));
    expect(screen.getByLabelText('Model per step')).toBeDefined();
  });

  it('Skip step N lives in the run menu', async () => {
    await mount('c09-orch-running');
    const menu = within(await openMenu());
    expect(menu.getByText('Skip step 3')).toBeDefined();
  });

  it('Add step, Create report and Create wireframe on a finished run', async () => {
    await mount('c09-orch-done');
    const result = within(nodeOf('[data-orchestrated-result]'));
    expect(result.getByRole('button', { name: 'Add step' })).toBeDefined();
    expect(result.getByRole('button', { name: 'Create report' })).toBeDefined();
    expect(result.getByRole('button', { name: /^Create wireframe/ })).toBeDefined();
  });

  it('Write destination shows on the document with 2 writable worktrees', async () => {
    await mount('c09-orch-running');
    act(() => {
      useAppStore.setState({
        sessionProjectMounts: { [C09_SESSION_ID]: [mountOf({ index: 0 }), mountOf({ index: 1 })] },
      });
    });
    await settle();
    expect(nodeOf('[data-orchestrated-run]').textContent).toMatch(/payments-api|ledger-core/);
  });

  it('Guidance and the process text sit behind Show guidance', async () => {
    await mount('c09-orch-running');
    expect(screen.queryByText(/behind the existing export flag/)).toBeNull();
    await press(screen.getByRole('button', { name: 'Show guidance' }));
    expect(screen.getByText(/behind the existing export flag/)).toBeDefined();
    expect(screen.getByText(/Measure before and after every change/)).toBeDefined();
  });

  it('Resume strip: agents a restart stopped resume from the tail', async () => {
    await mount('c09-orch-running');
    patchAgent({ id: C09_TESTER_ID, patch: { status: 'stopped', stoppedBy: 'app' } });
    await settle();
    expect(tail().getByText(/stopped when Goodboy closed/)).toBeDefined();
  });

  it('Step drawer: a checklist row opens the step in the pane, Open full goes to the agent', async () => {
    await mount('c09-orch-running');
    await press(checklist().getByRole('button', { name: /^Step 3, Run the 12k export benchmark/ }));
    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'run-step',
      payload: { runId: C09_RUN_ID, agentId: C09_TESTER_ID },
    });
  });

  it('Limit and spent: the facts line opens the run spend limit', async () => {
    await mount('c09-orch-running');
    const facts = within(nodeOf('[data-orchestrated-facts]'));
    await press(facts.getByTestId('run-spend-limit-trigger'));
    expect(screen.getByRole('dialog', { name: 'Spend cap for this run' })).toBeDefined();
  });
});
