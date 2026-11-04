// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { AutoPhase } from '@goodboy/db';
import { brandId, type AgentId } from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../store/storyHarness';
import { PLAN_FIXTURE_ID, aPlan } from '../../test/planFixtures';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { isStoppedByRestart } from '../../store/slices/turn/isStoppedByRestart';
import { planPrimaryOf } from '../plans/planPrimaryOf';
import { useSessionSuggestions } from '../suggestions/useSessionSuggestions';
import { isAutoPlanAwaitingApproval } from './isAutoPlanAwaitingApproval';
import { isPlanHeldByAuto } from './isPlanHeldByAuto';
import {
  FIXTURE_ROOT,
  FIXTURE_SESSION,
  aDelegation,
  aPlanRow,
  aView,
  anArtifactRow,
} from './testing/autoViewFixtures';

type AppStoreModule = typeof import('../../store');

let store: AppStoreModule['useAppStore'];

const idOf = (value: string): AgentId => brandId<AgentId>({ value });

const root = anAgent({
  id: FIXTURE_ROOT,
  sessionId: FIXTURE_SESSION,
  name: 'Auto',
  status: 'completed',
  kind: 'custom',
});

const stoppedImplementer = anAgent({
  id: idOf('agent-impl-1'),
  sessionId: FIXTURE_SESSION,
  parentAgentId: FIXTURE_ROOT,
  status: 'stopped',
  stoppedBy: 'app',
});

const session = aSession({ id: FIXTURE_SESSION, goal: 'Ship the credit retries' });

const planArtifact = () => {
  const row = aPlanRow({ approvalState: 'approved', approvedRevision: 1, revision: 1 });
  return { ...row, artifact: { ...row.artifact, artifactId: PLAN_FIXTURE_ID } };
};

const reports = () => [
  anArtifactRow({ id: 'artifact-report-1', kind: 'report', title: 'Review of payments-api' }),
  anArtifactRow({ id: 'artifact-report-2', kind: 'report', title: 'Review of ledger-core' }),
];

const delegations = () => [
  aDelegation({ key: 'planner', role: 'planner', state: 'settled', outcome: 'completed' }),
  aDelegation({ key: 'impl-1', role: 'implementer', state: 'settled', outcome: 'stopped' }),
  {
    ...aDelegation({ key: 'impl-2', role: 'implementer', state: 'settled', outcome: 'completed' }),
    retryOf: aDelegation({ key: 'impl-1', role: 'implementer', state: 'settled' }).id,
  },
];

type SeedParams = {
  readonly phase: AutoPhase;
  readonly artifacts?: AutoTreeView['artifacts'];
  readonly delegations?: AutoTreeView['delegations'];
  readonly isPlanListed?: boolean;
};

const seed = ({
  phase,
  artifacts = [planArtifact(), ...reports()],
  delegations: seeded = delegations(),
  isPlanListed = true,
}: SeedParams): AutoTreeView => {
  const view = aView({ phase, artifacts, delegations: seeded });
  store.setState({
    sessionPhaseRuns: { [FIXTURE_SESSION]: [root, stoppedImplementer] },
    autoTreeViews: { [FIXTURE_SESSION]: [view] },
    sessionPlans: {
      [FIXTURE_SESSION]: isPlanListed ? [aPlan({ sessionId: FIXTURE_SESSION })] : [],
    },
  });
  return view;
};

const kindsOf = async () => {
  const hook = renderHook(() => useSessionSuggestions({ session, withRebase: false }));
  await waitFor(() => {
    expect(hook.result.current).toBeDefined();
  });
  return hook.result.current.map((suggestion) => suggestion.kind);
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [] });
});

afterEach(() => {
  cleanup();
});

describe('a finished Auto run leaves nothing stale', () => {
  it('shows no approval wait, no Start on the plan and no Continue after the end', async () => {
    const view = seed({ phase: 'done' });

    expect(isAutoPlanAwaitingApproval({ view })).toBe(false);
    const kinds = await kindsOf();
    expect(kinds).not.toContain('plan-ready');
    expect(kinds).not.toContain('resume-agents');
  });

  it('never reads a reviewer report as a plan waiting on approval', () => {
    const view = seed({ phase: 'waiting', artifacts: reports() });

    expect(isAutoPlanAwaitingApproval({ view })).toBe(false);
  });
});

describe('a real waiting case still shows', () => {
  it.each<AutoPhase>(['done', 'answering'])(
    'keeps the approval wait of a plan in a %s tree',
    (phase) => {
      const row = aPlanRow({ approvalState: 'needs_approval' });
      const view = seed({ phase, artifacts: [row, ...reports()] });

      expect(isAutoPlanAwaitingApproval({ view })).toBe(true);
    },
  );

  it('keeps Continue for a stopped agent of a live tree', async () => {
    seed({
      phase: 'waiting',
      delegations: [
        aDelegation({ key: 'impl-1', role: 'implementer', state: 'running', outcome: null }),
      ],
    });

    expect(
      isStoppedByRestart({
        agent: stoppedImplementer,
        runs: [root, stoppedImplementer],
        views: store.getState().autoTreeViews[FIXTURE_SESSION] ?? [],
      }),
    ).toBe(true);
  });

  it('keeps Continue for a stopped agent of a preset run', () => {
    seed({ phase: 'done' });
    const stranger = anAgent({ id: idOf('agent-step'), status: 'stopped', stoppedBy: 'app' });

    expect(
      isStoppedByRestart({
        agent: stranger,
        runs: [stranger],
        views: store.getState().autoTreeViews[FIXTURE_SESSION] ?? [],
      }),
    ).toBe(true);
  });

  it('keeps Ready to implement for a standalone plan with no Auto', async () => {
    store.setState({
      sessionPhaseRuns: { [FIXTURE_SESSION]: [] },
      autoTreeViews: {},
      sessionPlans: { [FIXTURE_SESSION]: [aPlan({ sessionId: FIXTURE_SESSION })] },
    });

    expect(await kindsOf()).toContain('plan-ready');
  });
});

describe('a plan held by an Auto tree', () => {
  it('is owned by the tree and offers no Run plan', () => {
    const view = seed({ phase: 'waiting' });

    expect(isPlanHeldByAuto({ views: [view], planId: PLAN_FIXTURE_ID })).toBe(true);
    expect(isPlanHeldByAuto({ views: [], planId: PLAN_FIXTURE_ID })).toBe(false);
    const primary = planPrimaryOf({
      plan: aPlan(),
      run: null,
      drafts: [],
      isHeldByAuto: true,
    });
    expect(primary.kind).toBe('none');
    expect(planPrimaryOf({ plan: aPlan(), run: null, drafts: [] }).kind).toBe('run');
  });
});
