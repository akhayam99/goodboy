// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, screen } from '@testing-library/react';
import type { AgentId, WorkflowRunId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { ToastProvider } from '../../../shared/components/Toast';
import type { RunPlanResult } from '../../../store/slices/plans/types';
import { PLAN_FIXTURE_ID, PLAN_FIXTURE_SESSION } from '../../../test/planFixtures';
import { usePlanRun } from './index';

const wrapper = ({ children }: { readonly children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

const runWith = async (result: RunPlanResult | Error) => {
  const runPlan = vi.fn(async () => {
    if (result instanceof Error) {
      throw result;
    }
    return result;
  });
  useAppStore.setState({ runPlan });
  const hook = renderHook(
    () => usePlanRun({ sessionId: PLAN_FIXTURE_SESSION, planId: PLAN_FIXTURE_ID }),
    { wrapper },
  );
  await act(async () => {
    await hook.result.current.run();
  });
  return hook;
};

afterEach(cleanup);

describe('usePlanRun', () => {
  it('toasts the reason when the plan did not start, with the way to the run', async () => {
    await runWith({
      kind: 'refused',
      reason: 'The next step (Review) does not run plans',
      workflowRunId: 'run-settlement' as WorkflowRunId,
    });

    screen.getByText('Plan not started');
    screen.getByText('The next step (Review) does not run plans');
    screen.getByRole('button', { name: 'Open the run' });
    expect(screen.queryByText('Implementer started')).toBeNull();
  });

  it('toasts the start when an agent runs the plan', async () => {
    await runWith({ kind: 'started', agentId: 'agent-impl' as AgentId, scope: 'workflow' });

    screen.getByText('Implementer started');
    screen.getByRole('button', { name: 'Follow' });
  });

  it('says it started outside the workflow when the run was discarded', async () => {
    await runWith({
      kind: 'startedOutside',
      agentId: 'agent-impl' as AgentId,
      note: 'Started outside the run, it was discarded',
    });

    screen.getByText('Started outside the run, it was discarded');
  });

  it('keeps the failure on the hook when the store throws', async () => {
    const hook = await runWith(new Error('database is locked'));

    expect(hook.result.current.error).toContain('database is locked');
    expect(hook.result.current.isSpawning).toBe(false);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
