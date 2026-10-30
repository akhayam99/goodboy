// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { brandId, type AgentId, type MeasuredTurnSpan } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { WorkTimeContext, type WorkTimeSource } from '../../workTreeModel/workTimeSource';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { registerDelegationDecisionPort } from '../delegationDecisionPort';
import { registerPublishPort, type PublishPort } from '../publishPort';
import {
  aDelegation,
  anArtifactRow,
  aPlanRow,
  aView,
  FIXTURE_SESSION,
} from '../testing/autoViewFixtures';
import { AutoDelegationLines } from './AutoDelegationLines';

afterEach(cleanup);

const SESSION_ID = FIXTURE_SESSION;

const SETTLED_PLAN = aDelegation({
  key: 'planner',
  role: 'planner',
  state: 'settled',
  outcome: 'completed',
  settledAt: 1_000,
  result: {
    declared: { summary: 'A three part plan.' },
    artifacts: [
      { id: 'artifact-plan', kind: 'plan', title: 'Retry-safe credit retries', revision: 1 },
    ],
    cost: { usd: 0.12, basis: 'reported' },
  },
});

type RenderParams = {
  readonly view: AutoTreeView;
  readonly onOpenChild?: () => void;
  readonly onOpenArtifact?: () => void;
};

const renderLines = ({ view, onOpenChild = vi.fn(), onOpenArtifact = vi.fn() }: RenderParams) => {
  useAppStore.setState({ autoTreeViews: { [SESSION_ID]: [view] } });
  return render(
    <AutoDelegationLines
      sessionId={SESSION_ID}
      view={view}
      delegations={view.delegations}
      agents={[]}
      onOpenChild={onOpenChild}
      onOpenArtifact={onOpenArtifact}
    />,
  );
};

describe('AutoDelegationLines', () => {
  it('shows a running child as a live card: role, task, state word, opening by the card', () => {
    const onOpenChild = vi.fn();
    renderLines({
      view: aView({
        phase: 'waiting',
        delegations: [aDelegation({ key: 'impl', role: 'implementer', state: 'running' })],
      }),
      onOpenChild,
    });

    const line = screen.getByRole('listitem');
    expect(within(line).queryByText('Delegated to')).toBeNull();
    expect(within(line).getByRole('img', { name: 'Implementer' })).toBeDefined();
    expect(within(line).getByText('work for impl')).toBeDefined();
    expect(within(line).queryByText(/Reserved up to/)).toBeNull();
    within(line).getByText('Running');
    fireEvent.click(within(line).getByRole('button', { name: /^Open / }));
    expect(onOpenChild).toHaveBeenCalledWith('agent-impl');
  });

  it('draws the active work of a resumed child, as Working now and the Agents row do', () => {
    const agentId = brandId<AgentId>({ value: 'agent-impl' });
    const span = (startedAtMs: number, endedAtMs: number): MeasuredTurnSpan => ({
      agentId,
      parentAgentId: null,
      agentStatus: null,
      workflowRunId: null,
      isOrchestratedRunDone: false,
      stepRole: 'implementer',
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
      effort: null,
      startedAtMs,
      endedAtMs,
      endReason: 'succeeded',
      costUsd: null,
      touchedMountIds: null,
    });
    const start = Date.parse('2026-10-16T09:00:00.000Z');
    const minute = 60_000;
    const source: WorkTimeSource = {
      nowMs: start + 30 * minute,
      spans: [span(start, start + 2 * minute), span(start + 20 * minute, start + 21 * minute)],
      history: null,
      liveStartMs: new Map(),
      childrenOf: new Map(),
    };
    const view = aView({
      phase: 'waiting',
      delegations: [aDelegation({ key: 'impl', role: 'implementer', state: 'running' })],
    });
    useAppStore.setState({ autoTreeViews: { [SESSION_ID]: [view] } });

    render(
      <WorkTimeContext.Provider value={source}>
        <AutoDelegationLines
          sessionId={SESSION_ID}
          view={view}
          delegations={view.delegations}
          agents={[]}
          onOpenChild={vi.fn()}
          onOpenArtifact={vi.fn()}
        />
      </WorkTimeContext.Provider>,
    );

    expect(within(screen.getByRole('listitem')).getByText('3m').textContent).toBe('3m');
  });

  it('names two agents of one role apart by their task, as their result cards do', () => {
    renderLines({
      view: aView({
        phase: 'waiting',
        delegations: [
          aDelegation({ key: 'review-a', role: 'reviewer', state: 'running' }),
          aDelegation({ key: 'review-b', role: 'reviewer', state: 'running' }),
        ],
      }),
    });

    const lines = screen.getAllByRole('listitem');
    expect(within(lines[0] ?? document.body).getByText('work for review-a')).toBeDefined();
    expect(within(lines[1] ?? document.body).getByText('work for review-b')).toBeDefined();
    expect(within(lines[1] ?? document.body).getByRole('img', { name: 'Reviewer' })).toBeDefined();
  });

  it('asks for the plan approval under the Planner line, with the plan one click away', () => {
    const onOpenArtifact = vi.fn();
    renderLines({
      view: aView({ phase: 'waiting', delegations: [SETTLED_PLAN], artifacts: [aPlanRow()] }),
      onOpenArtifact,
    });

    expect(screen.getByText('Plan v1 needs your approval')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Approve plan' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ask for changes' })).toBeNull();
    expect(screen.getByText('View plan')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open plan Retry-safe credit retries' }));
    expect(onOpenArtifact).toHaveBeenCalledWith('artifact-plan');
  });

  it('settles the plan card to Plan v1 approved in the artifact tone instead of unmounting', () => {
    renderLines({
      view: aView({
        phase: 'waiting',
        delegations: [SETTLED_PLAN],
        artifacts: [aPlanRow({ approvalState: 'approved', approvedRevision: 1 })],
      }),
    });

    expect(screen.queryByText(/needs your approval/)).toBeNull();
    expect(screen.getByText('Plan v1 approved').getAttribute('data-tone')).toBe('merged');
    expect(
      screen.getAllByRole('button', { name: 'Open plan Retry-safe credit retries' }),
    ).toHaveLength(1);
  });

  it('draws no row for another artifact, the result card owns them', () => {
    const reviewer = aDelegation({
      key: 'reviewer',
      role: 'reviewer',
      state: 'settled',
      outcome: 'completed',
      settledAt: 1_000,
      result: {
        declared: { summary: 'Comparing the branch.' },
        artifacts: [
          { id: 'artifact-report', kind: 'report', title: 'Certify ledger-core', revision: 2 },
        ],
        cost: { usd: 0.2, basis: 'reported' },
      },
    });
    renderLines({
      view: aView({
        phase: 'waiting',
        delegations: [SETTLED_PLAN, reviewer],
        artifacts: [
          aPlanRow({ approvalState: 'approved', approvedRevision: 1 }),
          anArtifactRow({ id: 'artifact-report', kind: 'report', title: 'Certify ledger-core' }),
        ],
      }),
    });

    expect(screen.queryByRole('button', { name: /^Open report / })).toBeNull();
    expect(screen.queryByText('Approved')).toBeNull();
  });

  it('keeps one ask and no second row for a plan that needs approval', () => {
    renderLines({
      view: aView({ phase: 'waiting', delegations: [SETTLED_PLAN], artifacts: [aPlanRow()] }),
    });

    expect(
      screen.getAllByRole('button', { name: 'Open plan Retry-safe credit retries' }),
    ).toHaveLength(1);
  });

  it('shows a revision on the same producer line', () => {
    const revising = aDelegation({
      key: 'planner',
      role: 'planner',
      state: 'running',
      reviseOf: 'artifact-plan',
      baseRevision: 1,
    });
    renderLines({
      view: aView({
        phase: 'waiting',
        delegations: [revising],
        artifacts: [aPlanRow({ approvalState: 'revising', openRevise: 'delegation-planner' })],
      }),
    });

    expect(screen.getByText('revising v2')).toBeDefined();
  });
});

const waitingPush = ({ key, branch }: { readonly key: string; readonly branch: string }) =>
  aDelegation({
    key,
    role: 'implementer',
    state: 'settled',
    outcome: 'completed',
    settledAt: 1_000,
    result: {
      declared: { summary: 'Squashed.' },
      verified: {
        changedFiles: [],
        checks: [],
        publish: {
          mode: 'force',
          state: 'awaiting_confirm',
          branch,
          sha: 'abc1234',
          leaseSha: 'remote111',
          backupRef: 'refs/goodboy/backup/b-6b/keep-1',
          message: null,
          isRetryable: false,
          isConfirmed: false,
          tries: 0,
          reviewerReportId: null,
          isContentChanging: false,
        },
      },
      cost: { usd: 0.1, basis: 'reported' },
    },
  });

describe('the one confirm row of a batch of force pushes', () => {
  afterEach(() => registerPublishPort({ port: null }));

  const renderPushes = () =>
    renderLines({
      view: aView({
        phase: 'waiting',
        delegations: [
          waitingPush({ key: 'impl-a', branch: 'harborline/fix-ledger' }),
          waitingPush({ key: 'impl-b', branch: 'harborline/fix-notify' }),
        ],
      }),
    });

  it('names every branch once and offers one Force push and one Do not push', () => {
    renderPushes();

    expect(screen.getAllByRole('group', { name: 'Confirm the force push' })).toHaveLength(1);
    expect(
      screen.getByText(
        'Force push 2 branches? harborline/fix-ledger, harborline/fix-notify. Each earlier version is kept as a backup.',
      ),
    ).toBeDefined();
  });

  it('sends one confirm covering both branches', async () => {
    const port = vi.fn<PublishPort>(async () => ({ kind: 'done', rows: [] }));
    registerPublishPort({ port });
    renderPushes();

    fireEvent.click(screen.getByRole('button', { name: 'Force push' }));

    await waitFor(() => expect(port).toHaveBeenCalledOnce());
    expect(port).toHaveBeenCalledWith({
      act: 'confirm',
      delegationIds: ['delegation-impl-a', 'delegation-impl-b'],
    });
  });

  it('sends one decline for the whole batch', async () => {
    const port = vi.fn<PublishPort>(async () => ({ kind: 'done', rows: [] }));
    registerPublishPort({ port });
    renderPushes();

    fireEvent.click(screen.getByRole('button', { name: "Don't push" }));

    await waitFor(() =>
      expect(port).toHaveBeenCalledWith({
        act: 'decline',
        delegationIds: ['delegation-impl-a', 'delegation-impl-b'],
      }),
    );
  });

  it('shows no row when no push waits', () => {
    renderLines({
      view: aView({
        phase: 'waiting',
        delegations: [aDelegation({ key: 'impl', role: 'implementer', state: 'running' })],
      }),
    });

    expect(screen.queryByRole('group', { name: 'Confirm the force push' })).toBeNull();
  });
});

const REVISE_ASKING = aDelegation({
  key: 'planner-2',
  role: 'planner',
  state: 'awaiting_confirm',
  reviseOf: 'artifact-plan',
  baseRevision: 2,
});

const renderAsking = () =>
  renderLines({
    view: aView({
      phase: 'waiting',
      delegations: [REVISE_ASKING],
      artifacts: [{ ...aPlanRow({ revision: 2 }), title: 'Retry-safe credit retries' }],
    }),
  });

describe('the next step card of a delegation that waits for an OK', () => {
  afterEach(() => registerDelegationDecisionPort({ port: null }));

  it('replaces the Confirm row and names the revision it would start', () => {
    renderAsking();

    screen.getByRole('region', { name: 'Next step' });
    expect(screen.queryByRole('group', { name: 'Confirm this work' })).toBeNull();
    screen.getByRole('tab', { name: /Revise Retry-safe credit retries to v3/ });
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
  });
});

describe('the live child card', () => {
  const RUNNING = aDelegation({ key: 'impl', role: 'implementer', state: 'running' });
  const renderRunning = (delegation = RUNNING) =>
    renderLines({ view: aView({ phase: 'waiting', delegations: [delegation] }) });

  it('has no Stop button, the card opens the child and Stop lives in its menu', () => {
    renderRunning();

    expect(screen.queryByRole('button', { name: /^Stop / })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Open / })).toHaveLength(1);
  });

  it('turns into the bare line with no Stop once the delegation settled', () => {
    renderRunning(
      aDelegation({ key: 'impl', role: 'implementer', state: 'settled', outcome: 'completed' }),
    );

    expect(screen.queryByRole('button', { name: /^Stop / })).toBeNull();
    expect(screen.queryByText('Running')).toBeNull();
  });
});
