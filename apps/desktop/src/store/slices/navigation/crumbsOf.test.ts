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
  type IsoDateTime,
  type SessionArtifact,
  type SessionId,
  type StepId,
  type WorkflowRunId,
} from '@goodboy/types';
import { anAgent, aSession, aWorkflowRun } from '@goodboy/types/testing';
import { STORE_IMPORT_TIMEOUT_MS, importStore } from '../../storyHarness';
import type { AppState } from '../../types';
import { crumbsOf } from './crumbsOf';
import { parentPlace } from './parentPlace';
import { BOARD_PLACE, branchPlace, sessionPlace } from './place';
import type { Place } from './types';

const S1 = brandId<SessionId>({ value: 'session-ledger-core' });
const MAIN = brandId<AgentId>({ value: 'agent-planner' });
const CHILD = brandId<AgentId>({ value: 'agent-scout' });
const GRANDCHILD = brandId<AgentId>({ value: 'agent-tester' });
const STEP = brandId<AgentId>({ value: 'agent-step' });
const SUB_STEP = brandId<AgentId>({ value: 'agent-sub-step' });
const SUB_SUB_STEP = brandId<AgentId>({ value: 'agent-sub-sub-step' });
const ARTIFACT = brandId<ArtifactId>({ value: 'artifact-1' });
const DYNAMIC_RUN = brandId<WorkflowRunId>({ value: 'run-dynamic' });
const TITLE = 'Guard the settlement batch';
const FIRST = 'Overview';
const NOW = brandId<IsoDateTime>({ value: '2026-09-14T16:40:00.000Z' });

let appState: AppState;

beforeAll(async () => {
  const useAppStore = await importStore();
  appState = {
    ...useAppStore.getInitialState(),
    sessions: [
      aSession({
        id: S1,
        goal: TITLE,
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
  };
}, STORE_IMPORT_TIMEOUT_MS);

const agentAt = ({ agentId }: { readonly agentId: AgentId }): Place =>
  sessionPlace({ sessionId: S1, agentId });

type CrumbParams = {
  readonly place: Place;
};

const labelsOf = ({ place }: CrumbParams): ReadonlyArray<string> =>
  crumbsOf({ state: appState, place }).map((crumb) => crumb.label);

const RUN = sessionPlace({
  sessionId: S1,
  lens: 'workflows',
  target: { kind: 'run', runId: DYNAMIC_RUN },
});

describe('crumbsOf', () => {
  it.each<readonly [string, Place]>([
    ['the board', BOARD_PLACE],
    ['the Overview', sessionPlace({ sessionId: S1 })],
    ['a session tab', sessionPlace({ sessionId: S1, lens: 'questions' })],
    ['the Context tab', sessionPlace({ sessionId: S1, lens: 'context' })],
    ['an old Orchestrated address', sessionPlace({ sessionId: S1, lens: 'orchestrated' })],
  ])('draws no crumbs on %s, which shows the tabs', (_name, place) => {
    expect(labelsOf({ place })).toEqual([]);
  });

  it.each<readonly [string, Place, ReadonlyArray<string>]>([
    [
      'a file of a branchless session',
      sessionPlace({
        sessionId: S1,
        lens: 'files',
        target: { kind: 'diff', mountPath: null, focus: { kind: 'branch', path: 'src/ledger.ts' } },
      }),
      [FIRST, 'Changes'],
    ],
    ['a Lead', agentAt({ agentId: MAIN }), [FIRST, 'planner']],
    ['a sub agent', agentAt({ agentId: CHILD }), [FIRST, 'planner', 'scout']],
    ['a sub sub agent', agentAt({ agentId: GRANDCHILD }), [FIRST, 'planner', 'scout', 'tester']],
    ['a run', RUN, [FIRST, 'Runs', 'Close the settlement batch']],
    [
      'a run step',
      agentAt({ agentId: STEP }),
      [FIRST, 'Runs', 'Close the settlement batch', 'implementer'],
    ],
    [
      'a sub sub step',
      agentAt({ agentId: SUB_SUB_STEP }),
      [FIRST, 'Runs', 'Close the settlement batch', 'implementer', 'scout', 'reader'],
    ],
    [
      'an artifact gone from the list',
      sessionPlace({
        sessionId: S1,
        lens: 'plans',
        target: { kind: 'artifact', artifactId: ARTIFACT },
      }),
      [FIRST, 'Artifacts', 'Artifact'],
    ],
    ['a Branch section', branchPlace({ sessionId: S1, tab: 'commits' }), [FIRST, 'Branch']],
    [
      'a branch file',
      branchPlace({
        sessionId: S1,
        tab: 'files',
        focus: { kind: 'branch', path: 'src/ledger.ts' },
      }),
      [FIRST, 'Branch'],
    ],
    [
      'a thread',
      branchPlace({ sessionId: S1, tab: 'comments', threadId: 'thread-1' }),
      [FIRST, 'Branch'],
    ],
  ])('names the way from the session to %s', (_name, place, labels) => {
    expect(labelsOf({ place })).toEqual(labels);
  });

  it('names an artifact and a branch by their own names', () => {
    const plan: SessionArtifact = {
      id: ARTIFACT,
      sessionId: S1,
      agentId: MAIN,
      workflowRunId: null,
      kind: 'plan',
      schemaVersion: 1,
      title: 'Settlement plan',
      sourceFormat: 'markdown',
      sourceText: '## findings',
      metadata: {},
      status: 'active',
      revision: 1,
      sourceTurnId: null,
      createdAt: NOW,
      updatedAt: NOW,
      openedAt: null,
    };
    const named: AppState = { ...appState, sessionArtifacts: { [S1]: [plan] } };
    const artifact = sessionPlace({
      sessionId: S1,
      lens: 'plans',
      target: { kind: 'artifact', artifactId: ARTIFACT },
    });

    expect(crumbsOf({ state: named, place: artifact }).map((crumb) => crumb.label)).toEqual([
      FIRST,
      'Artifacts',
      'Settlement plan',
    ]);
  });

  it('points every crumb but the last at a place one Esc reaches', () => {
    const place = agentAt({ agentId: SUB_STEP });
    const crumbs = crumbsOf({ state: appState, place });
    const parent = crumbs[crumbs.length - 2];

    expect(parent?.place).toEqual(parentPlace({ state: appState, place }));
    expect(crumbs[0]?.place).toEqual(sessionPlace({ sessionId: S1 }));
  });
});
