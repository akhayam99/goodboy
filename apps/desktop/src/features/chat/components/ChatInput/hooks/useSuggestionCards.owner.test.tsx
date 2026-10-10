// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import {
  DEFAULT_WORKFLOW_RULES,
  type AgentId,
  type ArtifactId,
  type SessionId,
  type StepId,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession, aWorkflowRun, anAgent } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { aPlan } from '../../../../../test/planFixtures';
import type { SessionNudge } from '../../../../../store/slices/nudges/state';
import { useSuggestionCards } from './useSuggestionCards';

const SESSION_ID = 'session-harborline' as SessionId;
const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const RUN_ID = 'run-orchestrated' as WorkflowRunId;
const PLANNER_ID = 'agent-planner' as AgentId;
const PLAN_ID = 'plan-retries' as ArtifactId;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

const nudge: SessionNudge = {
  kind: 'plan-ready',
  id: 'nudge-1',
  agentId: PLANNER_ID,
  planId: PLAN_ID,
  planTitle: 'Retry-safe webhook credits',
};

const noop = () => undefined;
const asyncNoop = async () => undefined;

const wrapper = ({ children }: { readonly children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

const seed = ({ run }: { readonly run: 'none' | 'held' | 'approved' }) => {
  const runs =
    run === 'none'
      ? []
      : [
          aWorkflowRun({
            id: RUN_ID,
            executionMode: 'dynamic',
            ...(run === 'held'
              ? { orchestrationStop: { kind: 'plan-approval' as const, message: 'Approve it' } }
              : {}),
            rulesSnapshot: {
              ...DEFAULT_WORKFLOW_RULES,
              autonomy: 'plan',
              ...(run === 'approved' ? { planApproved: true } : {}),
            },
          }),
        ];
  const session = aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID, workflowRuns: runs });
  useAppStore.setState({
    sessions: [session],
    currentSessionId: SESSION_ID,
    sessionPlans: {
      [SESSION_ID]: [
        aPlan({
          id: PLAN_ID,
          agentId: PLANNER_ID,
          ...(run === 'none' ? {} : { workflowRunId: RUN_ID }),
        }),
      ],
    },
    sessionPhaseRuns: {
      [SESSION_ID]: [
        anAgent({
          id: PLANNER_ID,
          sessionId: SESSION_ID,
          status: 'completed',
          ...(run === 'none' ? {} : { workflowRunId: RUN_ID, stepId: 'step-plan' as StepId }),
        }),
      ],
    },
    sessionOpenQuestions: { [SESSION_ID]: [] },
  });
  return session;
};

const keysFor = async ({ run }: { readonly run: 'none' | 'held' | 'approved' }) => {
  const session = seed({ run });
  const { result } = renderHook(
    () =>
      useSuggestionCards({
        session: useAppStore.getState().sessions[0] ?? session,
        sessionNudge: nudge,
        activeAgentKind: null,
        scopePending: null,
        rightSizePending: null,
        rightSizeSuggestion: null,
        effectiveModel: 'sonnet',
        onScopeSpawn: noop,
        onScopeSendAnyway: noop,
        onScopeDismiss: noop,
        onUseSuggested: noop,
        onKeepCurrent: noop,
        onChangeModel: noop,
        dismissSessionNudge: asyncNoop,
        acceptSessionNudgeHandoff: asyncNoop,
      }).map((card) => card.key),
    { wrapper },
  );
  return result;
};

describe('the plan-ready nudge and the run that owns the plan', () => {
  it('offers the nudge for a plan no run owns', async () => {
    const keys = await keysFor({ run: 'none' });

    await waitFor(() => expect(keys.current).toEqual(['plan-ready']));
  });

  it('offers nothing for a plan an approved run owns before it picks the next step', async () => {
    const keys = await keysFor({ run: 'approved' });

    await new Promise<void>((resolve) => window.setTimeout(resolve, 200));
    expect(keys.current).toEqual([]);
  });

  it('offers nothing for a plan a run still holds for approval', async () => {
    const keys = await keysFor({ run: 'held' });

    await new Promise<void>((resolve) => window.setTimeout(resolve, 200));
    expect(keys.current).toEqual([]);
  });
});
