// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../../shared/lib/db', async () =>
  (await import('../../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  brandId,
  type Agent,
  type AgentStatus,
  type IsoDateTime,
  type ProviderRunId,
  type SessionMountView,
  type TurnState,
} from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import type { MountGithubState } from '../../../../../../store/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../../store/storyHarness';
import { mountGithubOf } from '../../../../../workspace/testing/sessionColumn';
import {
  aNowAgent,
  aNowRun,
  aNowStepAgent,
  aNowWorkflow,
  NOW_SESSION,
  NOW_STARTED_AT,
} from '../../../../central/now/testing/nowModelOf';
import type { AttachedRun } from '../../../../../workflows/activeWorkflowRuns';
import { aMountView } from '../../../../testing/aMountView';
import { aProjectMountOf } from '../../../../testing/aProjectMountOf';
import { sessionRunsOf } from '../../../../sessionRunsOf';
import { RunsGrid } from './index';

const session = aSession({ id: NOW_SESSION });
const PAYMENTS = aProject({ name: 'payments-api' });
const NOTIFY = aProject({ name: 'notify-relay' });
const LEDGER = aProject({ name: 'ledger-core' });
const DUP = aMountView({
  key: 'dup',
  sessionId: NOW_SESSION,
  projectId: PAYMENTS.id,
  projectName: 'payments-api',
  branch: 'fix/duplicate-credit',
});
const RETRY = aMountView({
  key: 'retry',
  sessionId: NOW_SESSION,
  projectId: NOTIFY.id,
  projectName: 'notify-relay',
  branch: 'feat/retry-budget',
});
const REC = aMountView({
  key: 'rec',
  sessionId: NOW_SESSION,
  projectId: LEDGER.id,
  projectName: 'ledger-core',
  branch: 'rec/1-schema',
});

const BLOCKED: TurnState = {
  kind: 'blocked',
  runId: brandId<ProviderRunId>({ value: 'run-harborline' }),
  blockedAt: NOW_STARTED_AT,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  localStorage.clear();
  await resetStoryStore();
});

afterEach(cleanup);

type MergedParams = {
  readonly view: SessionMountView;
  readonly number: number;
};

const mergedGithubOf = ({ view, number }: MergedParams): MountGithubState => {
  const github = mountGithubOf({ mount: aProjectMountOf({ view }), number });
  return { ...github, pr: github.pr === null ? null : { ...github.pr, state: 'merged' } };
};

type AgentParams = {
  readonly key: string;
  readonly name: string;
  readonly status: AgentStatus;
  readonly mount?: SessionMountView;
  readonly at: string;
};

const agentOf = ({ key, name, status, mount, at }: AgentParams): Agent => ({
  ...aNowAgent({ key, name, status }),
  mountId: mount?.id,
  startedAt: brandId<IsoDateTime>({ value: at }),
});

type WorldParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly mounts: ReadonlyArray<SessionMountView>;
  readonly github?: Readonly<Record<string, MountGithubState>>;
  readonly blockedIds?: ReadonlyArray<string>;
  readonly attached?: ReadonlyArray<AttachedRun>;
};

const renderWorld = ({
  agents,
  mounts,
  github = {},
  blockedIds = [],
  attached = [],
}: WorldParams) => {
  useAppStore.setState({
    sessionPhaseRuns: { [NOW_SESSION]: agents },
    sessionMounts: { [NOW_SESSION]: [...mounts] },
    sessionProjectMounts: { [NOW_SESSION]: mounts.map((view) => aProjectMountOf({ view })) },
    projects: [PAYMENTS, NOTIFY, LEDGER],
    mountGithub: github,
  });
  const runs = sessionRunsOf({
    attachedRuns: attached,
    agents,
    kindOverride: {},
    autoViews: [],
    orchestrating: {},
    questions: [],
    rootTurns: {},
    turnByAgentId: new Map(blockedIds.map((id) => [id, BLOCKED])),
    revisingStarts: {},
    mounts,
    projects: [PAYMENTS, NOTIFY, LEDGER],
  });
  return render(
    <ToastProvider>
      <RunsGrid session={session} runs={runs} />
    </ToastProvider>,
  );
};

const topHeadings = (): ReadonlyArray<string | null> =>
  screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);

const finishedToggle = (): HTMLElement => {
  const group = screen.getByRole('heading', { level: 2, name: 'Finished' }).closest('li');
  if (group === null) {
    throw new Error('no Finished group');
  }
  return within(group).getByRole('button', { name: /^(Show|Hide)$/ });
};

describe('Runs by branch order', () => {
  it('lists a new open branch above a branch merged long ago and folds the merged one', () => {
    renderWorld({
      mounts: [DUP, RETRY],
      github: { [DUP.id]: mergedGithubOf({ view: DUP, number: 10198 }) },
      agents: [
        agentOf({
          key: 'old',
          name: 'Block double credits',
          status: 'completed',
          mount: DUP,
          at: '2026-10-13T12:00:00.000Z',
        }),
        agentOf({
          key: 'new',
          name: 'Limit retries',
          status: 'completed',
          mount: RETRY,
          at: '2026-10-13T09:00:00.000Z',
        }),
      ],
    });

    expect(topHeadings()).toEqual(['feat/retry-budget', 'Finished']);
    expect(screen.queryByRole('list', { name: 'fix/duplicate-credit' })).toBeNull();
    expect(finishedToggle().getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(finishedToggle());

    const merged = screen.getByRole('list', { name: 'fix/duplicate-credit' });
    within(merged).getByRole('button', { name: /^Open Block double credits/ });
    screen.getByRole('heading', { level: 3, name: 'fix/duplicate-credit' });
    expect(finishedToggle().getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(finishedToggle());
    expect(screen.queryByRole('list', { name: 'fix/duplicate-credit' })).toBeNull();
  });

  it('keeps a merged branch in view while one of its runs is still running', () => {
    renderWorld({
      mounts: [DUP, RETRY],
      github: { [DUP.id]: mergedGithubOf({ view: DUP, number: 10198 }) },
      agents: [
        agentOf({
          key: 'live',
          name: 'Block double credits',
          status: 'running',
          mount: DUP,
          at: '2026-10-13T09:00:00.000Z',
        }),
        agentOf({
          key: 'new',
          name: 'Limit retries',
          status: 'completed',
          mount: RETRY,
          at: '2026-10-13T12:00:00.000Z',
        }),
      ],
    });

    expect(topHeadings()).toEqual(['fix/duplicate-credit', 'feat/retry-budget']);
  });

  it('lifts No branch to the top when one of its runs needs you', () => {
    renderWorld({
      mounts: [DUP, RETRY],
      blockedIds: ['agent-ask'],
      agents: [
        agentOf({
          key: 'ask',
          name: 'Explain the retry flow',
          status: 'running',
          at: '2026-10-13T08:00:00.000Z',
        }),
        agentOf({
          key: 'block',
          name: 'Block double credits',
          status: 'running',
          mount: DUP,
          at: '2026-10-13T12:00:00.000Z',
        }),
        agentOf({
          key: 'limit',
          name: 'Limit retries',
          status: 'running',
          mount: RETRY,
          at: '2026-10-13T11:00:00.000Z',
        }),
      ],
    });

    expect(topHeadings()).toEqual(['No branch', 'fix/duplicate-credit', 'feat/retry-budget']);
  });

  it('hides a branch whose worktree was removed until Finished is opened', () => {
    renderWorld({
      mounts: [{ ...DUP, isAttached: false, diskState: 'removed' }, RETRY, REC],
      agents: [
        agentOf({
          key: 'gone',
          name: 'Block double credits',
          status: 'completed',
          mount: DUP,
          at: '2026-10-13T12:00:00.000Z',
        }),
        agentOf({
          key: 'limit',
          name: 'Limit retries',
          status: 'running',
          mount: RETRY,
          at: '2026-10-13T10:00:00.000Z',
        }),
        agentOf({
          key: 'schema',
          name: 'Add the schema',
          status: 'completed',
          mount: REC,
          at: '2026-10-13T11:00:00.000Z',
        }),
      ],
    });

    expect(topHeadings()).toEqual(['feat/retry-budget', 'rec/1-schema', 'Finished']);
    expect(screen.queryByRole('button', { name: /^Open Block double credits/ })).toBeNull();

    fireEvent.click(finishedToggle());

    const gone = screen.getByRole('list', { name: 'fix/duplicate-credit' });
    within(gone).getByRole('button', { name: /^Open Block double credits/ });
  });

  it('groups by branch when the second branch is one whose worktree was removed', () => {
    renderWorld({
      mounts: [{ ...DUP, isAttached: false, diskState: 'removed' }, RETRY],
      agents: [
        agentOf({
          key: 'gone',
          name: 'Block double credits',
          status: 'completed',
          mount: DUP,
          at: '2026-10-13T12:00:00.000Z',
        }),
        agentOf({
          key: 'limit',
          name: 'Limit retries',
          status: 'running',
          mount: RETRY,
          at: '2026-10-13T10:00:00.000Z',
        }),
      ],
    });

    screen.getByRole('tab', { name: 'By state' });
    expect(topHeadings()).toEqual(['feat/retry-budget', 'Finished']);

    fireEvent.click(finishedToggle());

    const gone = screen.getByRole('list', { name: 'fix/duplicate-credit' });
    within(gone).getByRole('button', { name: /^Open Block double credits/ });
  });

  it('never lists an archived run, by branch or by state', () => {
    const old = aNowRun({
      key: 'old',
      title: 'Old layout fix',
      workflow: aNowWorkflow({ key: 'old', name: 'Fix a layout', stepNames: ['Find'] }),
      overrides: { discardedAt: NOW_STARTED_AT },
    });
    renderWorld({
      mounts: [DUP, RETRY],
      attached: [old],
      agents: [
        {
          ...aNowStepAgent({ attached: old, stepIndex: 0, status: 'completed', name: 'Find' }),
          mountId: DUP.id,
        },
        agentOf({
          key: 'block',
          name: 'Block double credits',
          status: 'running',
          mount: DUP,
          at: '2026-10-13T12:00:00.000Z',
        }),
        agentOf({
          key: 'limit',
          name: 'Limit retries',
          status: 'running',
          mount: RETRY,
          at: '2026-10-13T11:00:00.000Z',
        }),
      ],
    });

    expect(screen.queryByRole('button', { name: /Old layout fix/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /archived/ })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'By state' }));
    expect(screen.queryByRole('button', { name: /Old layout fix/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Archived' })).toBeNull();
  });

  it('draws a done row in the muted tone and keeps a live row at full weight', () => {
    renderWorld({
      mounts: [DUP, RETRY],
      agents: [
        agentOf({
          key: 'done',
          name: 'Block double credits',
          status: 'completed',
          mount: DUP,
          at: '2026-10-13T12:00:00.000Z',
        }),
        agentOf({
          key: 'live',
          name: 'Limit retries',
          status: 'running',
          mount: RETRY,
          at: '2026-10-13T11:00:00.000Z',
        }),
      ],
    });

    const titleOf = (name: string): Element | null =>
      screen
        .getByRole('button', { name: new RegExp(`^Open ${name}`) })
        .closest('li')
        ?.querySelector('[data-run-row-title]') ?? null;
    expect(titleOf('Block double credits')?.hasAttribute('data-finished')).toBe(true);
    expect(titleOf('Limit retries')?.hasAttribute('data-finished')).toBe(false);
  });
});
