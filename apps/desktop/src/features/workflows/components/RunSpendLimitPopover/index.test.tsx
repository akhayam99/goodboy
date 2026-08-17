// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId, WorkflowId, WorkflowRun, WorkflowRunId } from '@goodboy/types';

const { storeState } = vi.hoisted(() => ({
  storeState: {} as Record<string, unknown>,
}));

vi.mock('../../../../store/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) => selector(storeState),
}));

import { RunSpendLimitPopover } from './index';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;

const run = (overrides: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id: RUN_ID,
  workflowId: 'workflow-1' as WorkflowId,
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'dynamic',
  ...overrides,
});

const renderPopover = (runOverride: WorkflowRun = run()) =>
  render(<RunSpendLimitPopover sessionId={SESSION_ID} run={runOverride} variant="meta" />);

const openPopover = () => fireEvent.click(screen.getByTestId('run-spend-limit-trigger'));

beforeEach(() => {
  Object.assign(storeState, {
    setWorkflowRunSpendLimit: vi.fn(async () => undefined),
    sessionTelemetry: {},
    sessionPhaseRuns: {},
    agentRunHistory: {},
  });
});

afterEach(cleanup);

describe('RunSpendLimitPopover', () => {
  it('offers to set a limit on a run that has none, and reads no limit as infinite', () => {
    renderPopover();

    expect(screen.getByTestId('run-spend-limit-trigger').textContent).toContain(
      'Set a spend limit',
    );
    openPopover();

    const field = screen.getByTestId('spend-limit-amount') as HTMLInputElement;
    expect(field.value).toBe('');
    expect(field.getAttribute('placeholder')).toBe('no limit');
    expect(screen.queryByTestId('run-spend-limit-remove')).toBeNull();
    expect(screen.queryByRole('tab', { name: /notify/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /pause/i })).toBeNull();
  });

  it('saves the amount with the mode that says what happens at the limit', async () => {
    renderPopover();

    openPopover();
    fireEvent.change(screen.getByTestId('spend-limit-amount'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('tab', { name: /notify/i }));
    fireEvent.click(screen.getByTestId('run-spend-limit-save'));

    expect(storeState['setWorkflowRunSpendLimit']).toHaveBeenCalledWith(
      SESSION_ID,
      RUN_ID,
      25,
      'notify',
    );
    await screen.findByTestId('run-spend-limit-trigger');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('carries the limit already set into the trigger and the field', () => {
    renderPopover(run({ spendLimitUsd: 12.5, spendLimitMode: 'notify' }));

    expect(screen.getByTestId('run-spend-limit-trigger').textContent).toContain(
      'Spend limit $12.50',
    );
    openPopover();

    expect((screen.getByTestId('spend-limit-amount') as HTMLInputElement).value).toBe('12.5');
    expect(screen.getByRole('tab', { name: /notify/i }).getAttribute('aria-selected')).toBe('true');
  });

  it('takes the limit off without touching the amount left in the field', () => {
    renderPopover(run({ spendLimitUsd: 12.5, spendLimitMode: 'pause' }));

    openPopover();
    fireEvent.click(screen.getByTestId('run-spend-limit-remove'));

    expect(storeState['setWorkflowRunSpendLimit']).toHaveBeenCalledWith(
      SESSION_ID,
      RUN_ID,
      null,
      'pause',
    );
  });

  it('reads an emptied field as no limit at all', () => {
    renderPopover(run({ spendLimitUsd: 12.5 }));

    openPopover();
    fireEvent.change(screen.getByTestId('spend-limit-amount'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('run-spend-limit-save'));

    expect(storeState['setWorkflowRunSpendLimit']).toHaveBeenCalledWith(
      SESSION_ID,
      RUN_ID,
      null,
      'pause',
    );
  });

  it('says what the run has spent so far, so the limit is not set blind', () => {
    renderPopover();

    openPopover();

    expect(screen.getByRole('dialog').textContent).toContain('$0 spent so far');
  });
});
