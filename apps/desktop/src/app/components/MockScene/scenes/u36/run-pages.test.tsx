// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId, type AgentId } from '@goodboy/types';
import { ObjectMenuProvider } from '../../../../../features/actions/components/ObjectMenuProvider';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { C09_SESSION_ID, C09_TESTER_ID } from '../u25/c09OrchestratedSeed';
import { C08RunScene } from '../u25/C08RunScene';
import { C09OrchestratedScene } from '../u25/C09OrchestratedScene';
import { C08_IMPLEMENTER_ID, C08_REVIEWER_ID, C08_SESSION_ID } from '../u25/c08RunSeed';
import { U36_RUN_PAGES_SCENES } from './run-pages';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U36_RUN_PAGES_SCENES;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U36_RUN_PAGES_SCENES[name];
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <Scene />
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const HELPER_ID = brandId<AgentId>({ value: 'mock-c08-helper' });

const openHelperPage = (): void => {
  const state = useAppStore.getState();
  const parent = (state.sessionPhaseRuns[C08_SESSION_ID] ?? []).find(
    (agent) => agent.id === C08_IMPLEMENTER_ID,
  );
  if (parent === undefined) {
    return;
  }
  useAppStore.setState({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [C08_SESSION_ID]: [
        ...(state.sessionPhaseRuns[C08_SESSION_ID] ?? []),
        {
          ...parent,
          id: HELPER_ID,
          name: 'Read the batch writer',
          parentAgentId: parent.id,
          stepId: undefined,
          ordinal: 9,
        },
      ],
    },
    selectedAgentId: { ...state.selectedAgentId, [C08_SESSION_ID]: HELPER_ID },
  });
};

const openFailedChildOfDoneRun = (): void => {
  const state = useAppStore.getState();
  const reviewer = (state.sessionPhaseRuns[C08_SESSION_ID] ?? []).find(
    (agent) => agent.id === C08_REVIEWER_ID,
  );
  if (reviewer === undefined) {
    return;
  }
  useAppStore.setState({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [C08_SESSION_ID]: [
        ...(state.sessionPhaseRuns[C08_SESSION_ID] ?? []),
        {
          ...reviewer,
          id: HELPER_ID,
          name: 'Re-run the export checks',
          parentAgentId: reviewer.id,
          stepId: undefined,
          status: 'failed',
          ordinal: 9,
        },
      ],
    },
  });
};

const headOf = (): HTMLElement => {
  const head = [...document.querySelectorAll<HTMLElement>('[data-slot="pane-title-row"]')].at(-1);
  if (head === undefined) {
    throw new Error('no page head');
  }
  return head;
};

const nodeOf = (selector: string): HTMLElement => {
  const node = document.querySelector<HTMLElement>(selector);
  if (node === null) {
    throw new Error(`nothing matches ${selector}`);
  }
  return node;
};

describe('one run page', () => {
  it('registers every scene', () => {
    for (const [id, Scene] of Object.entries(U36_RUN_PAGES_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it.each(['u36-p12-preset-page', 'u36-p12-orch-page'] as const)(
    '%s draws one head, one glance and the same step list',
    async (name) => {
      await mount(name);

      within(headOf()).getByRole('heading', { level: 1 });
      within(headOf()).getByRole('button', { name: /run actions$/ });
      expect(document.querySelectorAll('[data-glance]')).toHaveLength(1);
      screen.getByRole('heading', { level: 2, name: 'Steps' });
      expect(document.querySelectorAll('[data-testid^="run-tree-row-"]').length).toBeGreaterThan(1);
    },
  );

  it('keeps Add step under the list of a preset run and off an orchestrated one', async () => {
    await mount('u36-p12-preset-page');
    within(nodeOf('[data-run-add-step]')).getByRole('button', { name: 'Add step' });
    cleanup();

    await mount('u36-p12-orch-page');
    expect(document.querySelector('[data-run-add-step]')).toBeNull();
  });

  it.each(['u36-p12-preset-page', 'u36-p12-orch-page'] as const)(
    '%s keeps the head menu within five rows and renames in place',
    async (name) => {
      await mount(name);

      fireEvent.click(within(headOf()).getByRole('button', { name: /run actions$/ }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SETTLE_MS);
      });
      const menu = screen.getByRole('menu');
      expect(within(menu).getAllByRole('menuitem').length).toBeLessThanOrEqual(5);
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Rename' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SETTLE_MS);
      });
      within(headOf()).getByRole('textbox', { name: 'Rename run' });
    },
  );

  it('double click on the head title renames in place', async () => {
    await mount('u36-p12-preset-page');

    fireEvent.doubleClick(within(headOf()).getByText('Fix flaky tests in the ledger export'));

    within(headOf()).getByRole('textbox', { name: 'Rename run' });
  });

  it('keeps the head menu within five rows and off Stop run when every step is done but a helper failed', async () => {
    render(
      <ToastProvider>
        <ObjectMenuProvider>
          <C08RunScene state="done" selection="overview" extra={openFailedChildOfDoneRun} />
        </ObjectMenuProvider>
      </ToastProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    fireEvent.click(within(headOf()).getByRole('button', { name: /run actions$/ }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    const menu = screen.getByRole('menu');
    expect(within(menu).getAllByRole('menuitem').length).toBeLessThanOrEqual(5);
    expect(within(menu).queryByRole('menuitem', { name: 'Stop run' })).toBeNull();
  });

  it('reads a blocked step as one dock line with Retry and one Continue, and the question once', async () => {
    await mount('u36-p12-orch-step-blocked');

    const dock = within(nodeOf('[data-dock-line="step-not-finished"]'));
    dock.getByText('Not finished');
    dock.getByRole('button', { name: 'Retry' });
    dock.getByRole('button', { name: 'Continue' });
    expect(screen.getAllByRole('button', { name: 'Continue' })).toHaveLength(1);
    expect(screen.getAllByText('Not finished')).toHaveLength(1);
    expect(document.querySelector('[data-blocked-question]')).toBeNull();
    expect(screen.queryByRole('form', { name: 'Answer the step' })).toBeNull();
    expect(
      screen.getAllByText(/Should I keep the report in the repo or only attach it to the notes\?/),
    ).toHaveLength(1);
    screen.getByPlaceholderText('Answer the step');
  });

  it('names the failure of Retry, keeps the step page and lets the same button try again', async () => {
    await mount('u36-p12-orch-step-blocked');
    const recoverStuckStep = vi.fn(async () => undefined);
    recoverStuckStep.mockRejectedValueOnce(new Error('The step could not be restarted.'));
    const reportError = vi.fn(async () => undefined);
    act(() => {
      useAppStore.setState({ recoverStuckStep, reportError });
    });
    const dock = within(nodeOf('[data-dock-line="step-not-finished"]'));

    await act(async () => {
      fireEvent.click(dock.getByRole('button', { name: 'Retry' }));
    });

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't retry the step", sessionId: C09_SESSION_ID }),
    );
    dock.getByText('Not finished');

    await act(async () => {
      fireEvent.click(dock.getByRole('button', { name: 'Retry' }));
    });

    expect(recoverStuckStep).toHaveBeenCalledTimes(2);
  });

  it('answers the blocked step with the text of the one field and clears it', async () => {
    await mount('u36-p12-orch-step-blocked');
    const answerBlockedStep = vi.fn(async () => undefined);
    act(() => {
      useAppStore.setState({ answerBlockedStep });
    });
    fireEvent.change(screen.getByPlaceholderText('Answer the step'), {
      target: { value: 'Attach it to the notes only.' },
    });

    await act(async () => {
      fireEvent.click(
        within(nodeOf('[data-dock-line="step-not-finished"]')).getByRole('button', {
          name: 'Continue',
        }),
      );
    });

    expect(answerBlockedStep).toHaveBeenCalledWith({
      sessionId: C09_SESSION_ID,
      agentId: C09_TESTER_ID,
      text: 'Attach it to the notes only.',
      override: expect.objectContaining({ explicit: false }),
    });
    expect(screen.getByPlaceholderText('Answer the step')).toHaveProperty('value', '');
  });

  it('asks the step to continue when Continue is pressed with no text', async () => {
    await mount('u36-p12-orch-step-blocked');
    const askAgentToContinue = vi.fn(async () => undefined);
    const answerBlockedStep = vi.fn(async () => undefined);
    act(() => {
      useAppStore.setState({ askAgentToContinue, answerBlockedStep });
    });

    await act(async () => {
      fireEvent.click(
        within(nodeOf('[data-dock-line="step-not-finished"]')).getByRole('button', {
          name: 'Continue',
        }),
      );
    });

    expect(askAgentToContinue).toHaveBeenCalledWith({
      sessionId: C09_SESSION_ID,
      agentId: C09_TESTER_ID,
      override: expect.objectContaining({ explicit: false }),
    });
    expect(answerBlockedStep).not.toHaveBeenCalled();
  });

  it('keeps the text and says why when the answer fails', async () => {
    await mount('u36-p12-orch-step-blocked');
    const answerBlockedStep = vi.fn(async () => {
      throw new Error('This step is no longer waiting for an answer.');
    });
    act(() => {
      useAppStore.setState({ answerBlockedStep });
    });
    fireEvent.change(screen.getByPlaceholderText('Answer the step'), {
      target: { value: 'Attach it to the notes only.' },
    });
    const dock = within(nodeOf('[data-dock-line="step-not-finished"]'));

    await act(async () => {
      fireEvent.click(dock.getByRole('button', { name: 'Continue' }));
    });

    expect(nodeOf('[data-dock-line="step-not-finished"]').textContent).toContain(
      'no longer waiting',
    );
    expect(screen.getByPlaceholderText('Answer the step')).toHaveProperty(
      'value',
      'Attach it to the notes only.',
    );
  });

  it.each([
    ['failed', 'Failed'],
    ['blocked', 'Needs you'],
  ] as const)(
    'reads a %s orchestrated run on a step page as one word and one link to the run',
    async (state, word) => {
      render(
        <ToastProvider>
          <ObjectMenuProvider>
            <C09OrchestratedScene state={state} page="stepPage" />
          </ObjectMenuProvider>
        </ToastProvider>,
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SETTLE_MS);
      });

      const tail = nodeOf('[data-run-tail]');
      expect(tail.getAttribute('data-run-tail')).toBe('openRun');
      within(tail).getByText(word);
      expect(
        within(tail)
          .getAllByRole('button')
          .map((button) => button.textContent),
      ).toEqual(['Open run']);
    },
  );

  it('opens the run menu from the keyboard on the head title and starts nothing on Enter or Space', async () => {
    await mount('u36-p12-preset-page');

    const title = within(headOf()).getByText('Fix flaky tests in the ledger export');
    expect(title.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(title, { key: 'Enter' });
    fireEvent.keyDown(title, { key: ' ' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(within(headOf()).queryByRole('textbox')).toBeNull();

    fireEvent.keyDown(title, { key: 'F10', shiftKey: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    const menu = screen.getByRole('menu');
    within(menu).getByRole('menuitem', { name: 'Pause run' });
    within(menu).getByRole('menuitem', { name: 'Copy run summary' });
  });

  it('leaves Open transcript out of the page it would only reopen', async () => {
    render(
      <ToastProvider>
        <ObjectMenuProvider>
          <C08RunScene state="working" selection="implementer" extra={openHelperPage} />
        </ObjectMenuProvider>
      </ToastProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    fireEvent.click(within(headOf()).getByRole('button', { name: 'Step actions' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    expect(
      within(screen.getByRole('menu')).queryByRole('menuitem', { name: 'Open transcript' }),
    ).toBeNull();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it.each(['u36-p12-step-page', 'u36-p12-orch-step-page'] as const)(
    '%s holds step verbs, with no run button in its head',
    async (name) => {
      await mount(name);

      expect(within(headOf()).queryByRole('button', { name: /run actions$/ })).toBeNull();
      within(headOf()).getByText(/^Step \d/);
      within(headOf()).getByRole('button', { name: 'Step actions' });
    },
  );

  it('keeps the run verb on one quiet line of the step page', async () => {
    await mount('u36-p12-step-page');

    const tail = within(nodeOf('[data-run-tail]'));
    tail.getByText('Step 2 done');
    tail.getByRole('button', { name: 'Start step 3' });
  });

  it('reads the reason of an orchestrated step on its page', async () => {
    await mount('u36-p12-orch-step-page');

    expect(nodeOf('[data-step-reason]').textContent).toContain(
      'The batching must be proven on 12,000 rows before any CSV work.',
    );
  });

  it('shows the outcome of a finished preset run, with no Settings and no tail', async () => {
    await mount('u36-p12-run-done');

    expect(screen.queryByRole('button', { name: 'Run settings' })).toBeNull();
    expect(document.querySelector('[data-run-tail]')).toBeNull();
    nodeOf('[data-orchestrated-result]');
    screen.getByRole('button', { name: 'Create report' });
  });
});

describe('the form and the row', () => {
  it('opens How with one line per kind', async () => {
    await mount('u36-p14-form-how-open');

    const kinds = screen.getByRole('tablist', { name: 'What kind of run?' });
    expect(within(kinds).getAllByRole('tab')).toHaveLength(4);
    within(kinds).getByText('Plans each next step as it goes.');
  });

  it('shows the rename field requested for the row', async () => {
    await mount('u36-f5-row-rename');

    screen.getByRole('textbox', { name: 'Rename run' });
  });
});

describe('the Branch page', () => {
  it('counts the runs on this branch on the Work tab, with no line under the tabs', async () => {
    storySpies.tauriInvoke.mockImplementation((command, args) => {
      if (command === 'db_select') {
        return Promise.resolve([]);
      }
      if (typeof command !== 'string') {
        throw new Error('The scene command must be a string.');
      }
      return sceneInvoke({ command, args });
    });
    await mount('u36-f3-branch-runs');

    expect(document.querySelector('[data-branch-runs-line]')).toBeNull();
    const strip = screen.getByRole('tablist', { name: 'Branch pages' });
    expect(within(strip).getByRole('tab', { name: /^Work/ }).textContent).toMatch(/^Work1$/);
  });
});
