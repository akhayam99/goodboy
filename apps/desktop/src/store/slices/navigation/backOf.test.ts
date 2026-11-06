// @vitest-environment node

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type AgentId,
  type ArtifactId,
  type SessionId,
  type StepId,
  type WorkflowRunId,
} from '@goodboy/types';
import { anAgent, aSession, aWorkflowRun } from '@goodboy/types/testing';
import { STORE_IMPORT_TIMEOUT_MS, importStore } from '../../storyHarness';
import type { AppState } from '../../types';
import { backOf } from './backOf';
import { BOARD_PLACE, branchPlace, sessionPlace } from './place';
import type { Place } from './types';

const S1 = brandId<SessionId>({ value: 'session-ledger-core' });
const MAIN = brandId<AgentId>({ value: 'agent-planner' });
const CHILD = brandId<AgentId>({ value: 'agent-scout' });
const GRANDCHILD = brandId<AgentId>({ value: 'agent-tester' });
const STEP = brandId<AgentId>({ value: 'agent-step' });
const RESOLVER = brandId<AgentId>({ value: 'agent-resolver' });
const SUB_STEP = brandId<AgentId>({ value: 'agent-sub-step' });
const SUB_SUB_STEP = brandId<AgentId>({ value: 'agent-sub-sub-step' });
const ARTIFACT = brandId<ArtifactId>({ value: 'artifact-1' });
const DYNAMIC_RUN = brandId<WorkflowRunId>({ value: 'run-dynamic' });

let appState: AppState;

beforeAll(async () => {
  const useAppStore = await importStore();
  appState = {
    ...useAppStore.getInitialState(),
    sessions: [
      aSession({
        id: S1,
        goal: 'Guard the settlement batch',
        workflowRuns: [
          aWorkflowRun({
            id: DYNAMIC_RUN,
            executionMode: 'dynamic',
            title: 'Close the settlement batch',
          }),
        ],
      }),
    ],
    sessionPhaseRuns: {
      [S1]: [
        anAgent({ id: MAIN, sessionId: S1, name: 'planner' }),
        anAgent({ id: CHILD, sessionId: S1, name: 'scout', parentAgentId: MAIN }),
        anAgent({ id: GRANDCHILD, sessionId: S1, name: 'tester', parentAgentId: CHILD }),
        anAgent({
          id: STEP,
          sessionId: S1,
          name: 'implementer',
          workflowRunId: DYNAMIC_RUN,
          stepId: brandId<StepId>({ value: 'step-1' }),
        }),
        anAgent({ id: RESOLVER, sessionId: S1, name: 'resolve: ana on a.ts:4' }),
        anAgent({
          id: SUB_STEP,
          sessionId: S1,
          name: 'scout',
          parentAgentId: STEP,
          workflowRunId: DYNAMIC_RUN,
          stepId: brandId<StepId>({ value: 'step-1-1' }),
        }),
        anAgent({
          id: SUB_SUB_STEP,
          sessionId: S1,
          name: 'reader',
          parentAgentId: SUB_STEP,
          workflowRunId: DYNAMIC_RUN,
          stepId: brandId<StepId>({ value: 'step-1-1-1' }),
        }),
      ],
    },
    agentKindOverride: { [RESOLVER]: 'resolver' },
  };
}, STORE_IMPORT_TIMEOUT_MS);

const agentAt = ({ agentId }: { readonly agentId: AgentId }): Place =>
  sessionPlace({ sessionId: S1, agentId });

type BackParams = {
  readonly place: Place;
};

const labelOf = ({ place }: BackParams): string | null =>
  backOf({ state: appState, place })?.label ?? null;

describe('backOf', () => {
  it.each<readonly [string, Place, string | null]>([
    ['the board', BOARD_PLACE, null],
    ['the Overview', sessionPlace({ sessionId: S1 }), null],
    ['a list page', sessionPlace({ sessionId: S1, lens: 'questions' }), 'Back to overview'],
    ['an old Agents address', sessionPlace({ sessionId: S1, lens: 'agents' }), 'Back to overview'],
    ['a main agent', agentAt({ agentId: MAIN }), 'Back to runs'],
    ['a sub agent', agentAt({ agentId: CHILD }), 'Back to planner'],
    ['a sub sub agent', agentAt({ agentId: GRANDCHILD }), 'Back to scout'],
    ['a run step', agentAt({ agentId: STEP }), 'Back to Close the settlement batch'],
    ['a sub step', agentAt({ agentId: SUB_STEP }), 'Back to implementer'],
    ['a sub sub step', agentAt({ agentId: SUB_SUB_STEP }), 'Back to scout'],
    [
      'a run',
      sessionPlace({
        sessionId: S1,
        lens: 'workflows',
        target: { kind: 'run', runId: DYNAMIC_RUN },
      }),
      'Back to runs',
    ],
    ['a resolver', agentAt({ agentId: RESOLVER }), 'Back to comments'],
    [
      'an artifact',
      sessionPlace({
        sessionId: S1,
        lens: 'plans',
        target: { kind: 'artifact', artifactId: ARTIFACT },
      }),
      'Back to artifacts',
    ],
    [
      'an issue',
      sessionPlace({
        sessionId: S1,
        lens: 'github_issue',
        target: { kind: 'github-issue', issueNumber: 12 },
      }),
      'Back to overview',
    ],
    ['a Branch section', branchPlace({ sessionId: S1, tab: 'commits' }), 'Back to overview'],
    [
      'a branch file',
      branchPlace({
        sessionId: S1,
        tab: 'files',
        focus: { kind: 'branch', path: 'src/ledger.ts' },
      }),
      'Back to branch',
    ],
    [
      'a thread',
      branchPlace({ sessionId: S1, tab: 'comments', threadId: 'thread-1' }),
      'Back to branch',
    ],
  ])('names the parent of %s', (_name, place, label) => {
    expect(labelOf({ place })).toBe(label);
  });

  it('names a run with no title and no workflow in its row as the run', () => {
    const untitled: AppState = {
      ...appState,
      sessions: appState.sessions.map((session) => ({
        ...session,
        workflowRuns: session.workflowRuns.map((run) => ({ ...run, title: null })),
      })),
    };
    expect(backOf({ state: untitled, place: agentAt({ agentId: STEP }) })?.label).toBe(
      'Back to run',
    );
  });

  it('points at the real parent place', () => {
    expect(backOf({ state: appState, place: agentAt({ agentId: GRANDCHILD }) })?.to).toEqual(
      sessionPlace({ sessionId: S1, lens: 'workflows', agentId: CHILD }),
    );
    expect(backOf({ state: appState, place: agentAt({ agentId: STEP }) })?.to).toEqual(
      sessionPlace({
        sessionId: S1,
        lens: 'workflows',
        target: { kind: 'run', runId: DYNAMIC_RUN },
      }),
    );
  });
});
