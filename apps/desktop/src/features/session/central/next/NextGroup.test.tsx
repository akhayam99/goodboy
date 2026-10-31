// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId, type AgentId, type MountId } from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { Place } from '../../../../store/slices/navigation/types';
import { upTrailOf } from '../../../../store/slices/navigation/upTrailOf';
import {
  FIXTURE_ROOT,
  FIXTURE_SESSION,
  aDelegation,
  aView,
} from '../../../auto/testing/autoViewFixtures';
import type { RebaseSuggestionTarget, SessionSuggestion } from '../../../suggestions/types';
import { actionCardsOf, type AutoActionTarget } from './actionCardsOf';
import { NextGroup } from './NextGroup';
import { nextGroupsOf, type NextGroupModel } from './nextGroupsOf';
import { useActionCardActions } from './useActionCardActions';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    listNudgeEvents: vi.fn(async () => []),
  }),
);

const SESSION = aSession({ id: FIXTURE_SESSION });
const HOME = brandId<MountId>({ value: 'mount-home' });
const BILLING = brandId<MountId>({ value: 'mount-billing' });

type ChildParams = {
  readonly page: string;
  readonly mountId: MountId;
};

const childOf = ({ page, mountId }: ChildParams): AutoActionTarget => ({
  agentId: brandId<AgentId>({ value: `agent-${page}-reviewer` }),
  rootAgentId: FIXTURE_ROOT,
  role: `Review the ${page} page`,
  noun: 'Reviewer',
  kind: 'timedOut',
  reason: null,
  reasonCode: 'deadline_passed',
  mountId,
  plan: null,
  canRetry: true,
});

const HOME_CHILD = childOf({ page: 'home', mountId: HOME });
const BILLING_CHILD = childOf({ page: 'billing', mountId: BILLING });

const HOME_BUILDER: AutoActionTarget = {
  ...HOME_CHILD,
  agentId: brandId<AgentId>({ value: 'agent-home-builder' }),
  role: 'Build the home page',
  noun: 'Builder',
  kind: 'failed',
};

const CHILDREN = [
  { key: 'home', agentId: HOME_CHILD.agentId },
  { key: 'billing', agentId: BILLING_CHILD.agentId },
  { key: 'home-build', agentId: HOME_BUILDER.agentId },
];

type TargetParams = {
  readonly mountId: MountId;
};

const rebaseTargetOf = ({ mountId }: TargetParams): RebaseSuggestionTarget => ({
  id: `${mountId}`,
  mountId,
  projectId: brandId({ value: 'project-harbor' }),
  projectName: 'harbor-portal',
  branch: `hl/${mountId}`,
  worktreePath: `/work/${mountId}`,
  baseBranch: 'main',
  behind: 3,
  dirtyCount: 0,
});

const REBASE: SessionSuggestion = {
  id: 'rebase-project:harbor-portal',
  kind: 'rebase-project',
  priority: 40,
  band: 2,
  title: 'Rebase harbor-portal',
  sessionId: FIXTURE_SESSION,
  fingerprint: 'rebase-project:harbor-portal',
  targetKey: null,
  payload: {
    targets: [rebaseTargetOf({ mountId: HOME }), rebaseTargetOf({ mountId: BILLING })],
  },
};

type SourcesParams = {
  readonly autoTargets?: ReadonlyArray<AutoActionTarget>;
  readonly suggestions?: ReadonlyArray<SessionSuggestion>;
};

const groupOf = ({ autoTargets = [], suggestions = [] }: SourcesParams): NextGroupModel => {
  const [group] = nextGroupsOf({
    cards: actionCardsOf({ owners: [], suggestions, autoTargets }),
    seen: [],
  });
  if (group === undefined) {
    throw new Error('Expected a group');
  }
  return group;
};

type HarnessProps = {
  readonly group: NextGroupModel;
};

const Harness = ({ group }: HarnessProps) => {
  const { actionsFor, openFor } = useActionCardActions({ session: SESSION });
  return (
    <NextGroup
      group={group}
      hasLabel
      isLead
      isNarrow={false}
      actionsFor={actionsFor}
      openFor={openFor}
    />
  );
};

const mount = ({ group }: HarnessProps) =>
  render(
    <ToastProvider>
      <Harness group={group} />
    </ToastProvider>,
  );

let useAppStore: StoryStore;
type Store = ReturnType<StoryStore['getState']>;

const continueStoppedAgent = vi.fn<Store['continueStoppedAgent']>();
const loadAutoTrees = vi.fn<Store['loadAutoTrees']>();
const rebaseAll = vi.fn<Store['rebaseAll']>();
const navigate = vi.fn<Store['navigate']>();

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  continueStoppedAgent.mockReset();
  continueStoppedAgent.mockResolvedValue(undefined);
  loadAutoTrees.mockReset();
  loadAutoTrees.mockResolvedValue(undefined);
  rebaseAll.mockReset();
  rebaseAll.mockResolvedValue('done');
  navigate.mockReset();
  useAppStore.setState({
    sessions: [SESSION],
    sessionPhaseRuns: {
      [FIXTURE_SESSION]: [
        anAgent({ id: FIXTURE_ROOT, kind: 'auto', status: 'running' }),
        ...CHILDREN.map((child) =>
          anAgent({ id: child.agentId, kind: 'reviewer', parentAgentId: FIXTURE_ROOT }),
        ),
      ],
    },
    autoTreeViews: {
      [FIXTURE_SESSION]: [
        aView({
          phase: 'answering',
          delegations: CHILDREN.map((child) => ({
            ...aDelegation({ key: child.key, role: 'reviewer', state: 'settled' }),
            outcome: 'timed_out',
            childAgentId: child.agentId,
          })),
        }),
      ],
    },
    continueStoppedAgent,
    loadAutoTrees,
    rebaseAll,
    navigate,
  });
});

afterEach(() => {
  cleanup();
});

type RowParams = {
  readonly title: string;
};

const rowOf = ({ title }: RowParams): HTMLElement => {
  const row = screen.getByText(title).closest<HTMLElement>('[data-action-card]');
  if (row === null) {
    throw new Error(`no row ${title}`);
  }
  return row;
};

describe('Retry all from Fix', () => {
  it('retries each row, keeps a failed row with its error and runs again on a second click', async () => {
    continueStoppedAgent.mockImplementation(async ({ agentId }) => {
      if (agentId === BILLING_CHILD.agentId && continueStoppedAgent.mock.calls.length <= 2) {
        throw new Error('Auto is not running');
      }
    });
    mount({ group: groupOf({ autoTargets: [HOME_CHILD, BILLING_CHILD] }) });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry the 2 stuck agents' }));
    });

    expect(continueStoppedAgent.mock.calls.map(([call]) => call?.agentId).sort()).toEqual(
      [BILLING_CHILD.agentId, HOME_CHILD.agentId].sort(),
    );
    const failed = screen.getAllByRole('alert');
    expect(failed.map((alert) => alert.textContent)).toEqual(['Auto is not running']);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry the 2 stuck agents' }));
    });

    expect(continueStoppedAgent).toHaveBeenCalledTimes(4);
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
  });

  it('counts and retries the stuck agents folded into a branch row, keeping a failed one', async () => {
    continueStoppedAgent.mockImplementation(async ({ agentId }) => {
      if (agentId === HOME_BUILDER.agentId) {
        throw new Error('Auto is not running');
      }
    });
    mount({ group: groupOf({ autoTargets: [HOME_CHILD, HOME_BUILDER, BILLING_CHILD] }) });

    expect(screen.getAllByRole('button', { name: /Retry .*"/ })).toHaveLength(2);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry the 3 stuck agents' }));
    });

    expect(continueStoppedAgent.mock.calls.map(([call]) => call?.agentId).sort()).toEqual(
      [BILLING_CHILD.agentId, HOME_BUILDER.agentId, HOME_CHILD.agentId].sort(),
    );
    expect(screen.getAllByRole('alert').map((alert) => alert.textContent)).toEqual([
      'Auto is not running',
    ]);
    expect(screen.getByRole('button', { name: 'Retry the 3 stuck agents' })).not.toBeNull();
  });

  it('retries two stuck agents folded into one branch row', async () => {
    mount({ group: groupOf({ autoTargets: [HOME_CHILD, HOME_BUILDER] }) });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry the 2 stuck agents' }));
    });

    expect(continueStoppedAgent.mock.calls.map(([call]) => call?.agentId).sort()).toEqual(
      [HOME_BUILDER.agentId, HOME_CHILD.agentId].sort(),
    );
  });

  it('offers no bulk retry for one stuck row', () => {
    mount({ group: groupOf({ autoTargets: [HOME_CHILD] }) });

    expect(screen.queryByRole('button', { name: /stuck agents/ })).toBeNull();
  });
});

describe('Rebase all from Update', () => {
  it('opens the rebase picker and starts the same rebase with every branch', async () => {
    mount({ group: groupOf({ suggestions: [REBASE] }) });

    fireEvent.click(screen.getByRole('button', { name: 'Rebase all' }));
    const picker = screen.getByRole('group', { name: 'Branches to rebase' });
    await act(async () => {
      fireEvent.click(within(picker).getByRole('button', { name: /Rebase/ }));
    });

    expect(rebaseAll).toHaveBeenCalledWith({
      sessionId: FIXTURE_SESSION,
      mountIds: [HOME, BILLING],
      shouldTidy: false,
    });
    expect(screen.queryByRole('group', { name: 'Branches to rebase' })).toBeNull();
  });
});

const BRANCH_CHECKS: Place = {
  at: 'session',
  sessionId: FIXTURE_SESSION,
  view: {
    lens: 'branch',
    agentId: null,
    target: {
      kind: 'branch',
      mountPath: null,
      tab: 'checks',
      threadId: null,
      focus: null,
    },
  },
};

describe('a row click opens its place', () => {
  it('opens the stuck agent and the branch checks, under the session in the trail', () => {
    const checks: SessionSuggestion = {
      id: `fix-checks:${HOME}`,
      kind: 'fix-checks',
      priority: 20,
      band: 1,
      title: 'Fix failing checks on #9995',
      sessionId: FIXTURE_SESSION,
      fingerprint: `fix-checks:${HOME}`,
      targetKey: `pr:${HOME}`,
      payload: { mountId: HOME, projectName: 'harbor-portal', prNumber: 9995 },
    };
    mount({ group: groupOf({ autoTargets: [BILLING_CHILD], suggestions: [checks] }) });

    fireEvent.click(screen.getByText('Auto is stuck'));
    fireEvent.click(screen.getByText('Fix failing checks on #9995'));
    fireEvent.click(
      within(rowOf({ title: 'Auto is stuck' })).getByRole('button', { name: /Retry/ }),
    );

    expect(navigate.mock.calls.map(([call]) => call.to)).toEqual([
      { at: 'agent', sessionId: FIXTURE_SESSION, agentId: BILLING_CHILD.agentId },
      BRANCH_CHECKS,
    ]);
    expect(
      upTrailOf({ state: useAppStore.getState(), place: BRANCH_CHECKS, onUp: () => undefined }).map(
        (segment) => segment.label,
      ),
    ).toEqual([SESSION.goal, 'Branch']);
  });

  it('opens the place from the keyboard once', () => {
    mount({ group: groupOf({ autoTargets: [BILLING_CHILD] }) });

    fireEvent.keyDown(screen.getByRole('link', { name: 'Auto is stuck' }), { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('link', { name: 'Auto is stuck' }), { key: 'Tab' });

    expect(navigate.mock.calls.map(([call]) => call.to)).toEqual([
      { at: 'agent', sessionId: FIXTURE_SESSION, agentId: BILLING_CHILD.agentId },
    ]);
  });
});
