// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  brandId,
  DEFAULT_WORKFLOW_RULES,
  type SessionId,
  type WorkflowId,
  type WorkflowRun,
  type WorkflowRunId,
} from '@goodboy/types';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../../store/storyHarness';

let useAppStore: StoryStore;
let useRunLimitDraft: typeof import('./index').useRunLimitDraft;

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });

const RUN: WorkflowRun = {
  id: brandId<WorkflowRunId>({ value: 'run-harborline' }),
  workflowId: brandId<WorkflowId>({ value: 'workflow-orchestrated' }),
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'dynamic',
  spendLimitUsd: 5,
  rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'step' },
};

beforeAll(async () => {
  useAppStore = await importStore();
  ({ useRunLimitDraft } = await import('./index'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('useRunLimitDraft', () => {
  it('commits an edit made while an earlier submit is in flight once that one settles', async () => {
    const limits: Array<number | null> = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    useAppStore.setState({
      setWorkflowRunSpendLimit: vi.fn(
        async (_sessionId: SessionId, _runId: WorkflowRunId, limit: number | null) => {
          limits.push(limit);
          await gate;
        },
      ),
    });
    const { result, rerender } = renderHook(
      ({ isOpen }) => useRunLimitDraft({ sessionId: SESSION_ID, run: RUN, isOpen }),
      { initialProps: { isOpen: true } },
    );

    await act(async () => {
      result.current.remove();
    });
    act(() => result.current.setAmount({ amount: '9' }));
    await act(async () => {
      rerender({ isOpen: false });
    });

    expect(limits).toEqual([null]);

    await act(async () => {
      release();
      await gate;
    });

    expect(limits).toEqual([null, 9]);
  });
});
