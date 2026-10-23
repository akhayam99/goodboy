// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  brandId,
  DEFAULT_WORKFLOW_RULES,
  type Session,
  type WorkflowId,
  type WorkflowRun,
  type WorkflowRunId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import { RUN_AUTONOMY_HEADER } from '../../runAutonomy';

let useAppStore: StoryStore;
let RunSettingsLine: typeof import('./index').RunSettingsLine;

const RUN_ID = brandId<WorkflowRunId>({ value: 'run-center-member-pages' });

const RUN: WorkflowRun = {
  id: RUN_ID,
  workflowId: brandId<WorkflowId>({ value: 'workflow-orchestrated' }),
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'dynamic',
  spendLimitUsd: 5,
  rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'step' },
};

const SESSION: Session = aSession({ goal: 'Center every member page', workflowRuns: [RUN] });

const PROVIDERS = JSON.parse(
  JSON.stringify(
    ['anthropic', 'codex'].map((id) => ({
      id,
      binary: id,
      label: id,
      error: null,
      docsUrl: '',
      version: '1.0.0',
      identity: null,
      connection: 'connected',
      capabilities: { models: [], efforts: [], features: [] },
    })),
  ),
);

beforeAll(async () => {
  useAppStore = await importStore();
  ({ RunSettingsLine } = await import('./index'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessions: [SESSION],
    providers: PROVIDERS,
  });
});

afterEach(cleanup);

const runNow = (): WorkflowRun => useAppStore.getState().sessions[0]?.workflowRuns[0] ?? RUN;

const show = () => render(<RunSettingsLine session={SESSION} run={runNow()} isOpen />);

const chip = (label: string) =>
  within(screen.getByRole('group', { name: 'Run settings' })).getByRole('button', {
    name: new RegExp(`^${label}:`),
  });

const settle = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('the run settings line', () => {
  it('opens one popover per chip that holds only its own setting and where it comes from', () => {
    show();

    fireEvent.click(chip('Limit'));
    const popover = screen.getByRole('dialog', { name: 'Limit' });
    expect(popover.textContent).toContain('This run $5.00');
    expect(popover.textContent).toContain('comes first');
    expect(popover.textContent).not.toContain(RUN_AUTONOMY_HEADER);
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('applies a new answer to when it asks on click, for the run it names', async () => {
    const setWorkflowRunAutonomy = vi.fn(async () => undefined);
    useAppStore.setState({ setWorkflowRunAutonomy });
    show();

    fireEvent.click(chip(RUN_AUTONOMY_HEADER));
    const popover = screen.getByRole('dialog', { name: RUN_AUTONOMY_HEADER });
    const [, middle] = within(popover).getAllByRole('tab');
    if (middle === undefined) {
      throw new Error('the asks popover has three answers');
    }
    await act(async () => {
      fireEvent.click(middle);
    });

    expect(setWorkflowRunAutonomy).toHaveBeenCalledWith(SESSION.id, RUN_ID, 'plan');
  });

  it('keeps the old answer and says why when the write fails', async () => {
    useAppStore.setState({
      setWorkflowRunAutonomy: vi.fn(async () => {
        throw new Error('database is locked');
      }),
    });
    show();
    const before = chip(RUN_AUTONOMY_HEADER).getAttribute('aria-label');

    fireEvent.click(chip(RUN_AUTONOMY_HEADER));
    const popover = screen.getByRole('dialog', { name: RUN_AUTONOMY_HEADER });
    const [, middle] = within(popover).getAllByRole('tab');
    if (middle === undefined) {
      throw new Error('the asks popover has three answers');
    }
    await act(async () => {
      fireEvent.click(middle);
    });

    expect(within(popover).getByRole('alert').textContent).toContain('database is locked');
    expect(chip(RUN_AUTONOMY_HEADER).getAttribute('aria-label')).toBe(before);
  });

  it('applies the limit on Enter', async () => {
    const setWorkflowRunSpendLimit = vi.fn(async () => undefined);
    useAppStore.setState({ setWorkflowRunSpendLimit });
    show();

    fireEvent.click(chip('Limit'));
    const popover = screen.getByRole('dialog', { name: 'Limit' });
    fireEvent.change(within(popover).getByLabelText('Limit in dollars'), {
      target: { value: '7' },
    });
    await act(async () => {
      fireEvent.submit(within(popover).getByRole('form', { name: 'Limit for this run' }));
    });

    expect(setWorkflowRunSpendLimit).toHaveBeenCalledWith(SESSION.id, RUN_ID, 7, 'pause');
  });

  it('applies a limit with cents when the person types it and presses Enter', async () => {
    const setWorkflowRunSpendLimit = vi.fn(async () => undefined);
    useAppStore.setState({ setWorkflowRunSpendLimit });
    const user = userEvent.setup();
    show();

    await user.click(chip('Limit'));
    const field = within(screen.getByRole('dialog', { name: 'Limit' })).getByLabelText(
      'Limit in dollars',
    );
    await user.clear(field);
    await user.type(field, '2.50{Enter}');

    expect(setWorkflowRunSpendLimit).toHaveBeenCalledWith(SESSION.id, RUN_ID, 2.5, 'pause');
  });

  it('turns a provider off live and Undo puts the pool back', async () => {
    const pools: Array<unknown> = [];
    useAppStore.setState({
      setWorkflowRunProviderPool: vi.fn(async ({ pool }) => {
        pools.push(pool);
        useAppStore.setState((state) => ({
          sessions: state.sessions.map((session) => ({
            ...session,
            workflowRuns: session.workflowRuns.map((run) =>
              pool === null ? { ...run, providerPool: undefined } : { ...run, providerPool: pool },
            ),
          })),
        }));
        return 'applied' as const;
      }),
    });
    show();

    fireEvent.click(chip('Models'));
    const popover = screen.getByRole('dialog', { name: 'Models' });
    await act(async () => {
      fireEvent.click(within(popover).getByRole('switch', { name: 'Codex' }));
    });
    await settle();

    expect(pools).toEqual([['anthropic']]);
    expect(useAppStore.getState().undoStack).toHaveLength(1);

    await act(async () => {
      await useAppStore.getState().undoLastOperation();
    });

    expect(pools).toEqual([['anthropic'], null]);
    expect(runNow().providerPool).toBeUndefined();
  });
});
