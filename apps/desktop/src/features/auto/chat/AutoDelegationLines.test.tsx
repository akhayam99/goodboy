// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useAppStore } from '../../../store';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { registerDelegationDecisionPort } from '../delegationDecisionPort';
import { aDelegation, aPlanRow, aView, FIXTURE_SESSION } from '../testing/autoViewFixtures';
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
  it('says one bare line per hand over: the role, the task and Open, the rail owning the state', () => {
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
    expect(within(line).getByText('Implementer')).toBeDefined();
    expect(within(line).queryByText(/Reserved up to/)).toBeNull();
    expect(within(line).queryByText('Running')).toBeNull();
    fireEvent.click(within(line).getByRole('button', { name: /^Open / }));
    expect(onOpenChild).toHaveBeenCalledWith('agent-impl');
  });

  it('names two agents of one role apart, as their result cards do', () => {
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
    expect(within(lines[0] ?? document.body).getByText('Reviewer 1')).toBeDefined();
    expect(within(lines[1] ?? document.body).getByText('Reviewer 2')).toBeDefined();
  });

  it('asks for the plan approval under the Planner line, with the plan one click away', () => {
    const onOpenArtifact = vi.fn();
    renderLines({
      view: aView({ phase: 'waiting', delegations: [SETTLED_PLAN], artifacts: [aPlanRow()] }),
      onOpenArtifact,
    });

    expect(screen.getByText('Plan v1 needs your approval')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Approve plan' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Ask for changes' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open plan Retry-safe credit retries' }));
    expect(onOpenArtifact).toHaveBeenCalledWith('artifact-plan');
  });

  it('drops the ask once the plan is approved', () => {
    renderLines({
      view: aView({
        phase: 'waiting',
        delegations: [SETTLED_PLAN],
        artifacts: [aPlanRow({ approvalState: 'approved', approvedRevision: 1 })],
      }),
    });

    expect(screen.queryByText(/needs your approval/)).toBeNull();
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

describe('the confirm row of a delegation that waits for an OK', () => {
  afterEach(() => registerDelegationDecisionPort({ port: null }));

  it('names the plan and version it would change and offers Confirm and Cancel', () => {
    renderAsking();

    expect(screen.getByText('Revise Retry-safe credit retries to v3?')).toBeDefined();
    expect(screen.getByRole('group', { name: 'Confirm this work' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
  });

  it('sends the answer once to the port and leaves the line to the next read', async () => {
    const port = vi.fn(async () => 'confirmed' as const);
    registerDelegationDecisionPort({ port });
    renderAsking();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(port).toHaveBeenCalledOnce());
    expect(port).toHaveBeenCalledWith({
      delegationId: 'delegation-planner-2',
      decision: 'confirm',
    });
  });

  it('sends a decline for Cancel', async () => {
    const port = vi.fn(async () => 'declined' as const);
    registerDelegationDecisionPort({ port });
    renderAsking();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(port).toHaveBeenCalledWith({
        delegationId: 'delegation-planner-2',
        decision: 'decline',
      }),
    );
  });

  it('says so when the question is no longer open and when no window can take the answer', async () => {
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({ reportError });
    registerDelegationDecisionPort({ port: async () => 'lost' });
    renderAsking();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(reportError).toHaveBeenCalledOnce());
    expect(reportError).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Auto has already moved on' }),
    );

    registerDelegationDecisionPort({ port: null });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(reportError).toHaveBeenCalledTimes(2));
    expect(reportError).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Couldn't answer Auto" }),
    );
  });

  it('reports a port that throws and frees the buttons again', async () => {
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({ reportError });
    registerDelegationDecisionPort({
      port: async () => {
        throw new Error('database is locked');
      },
    });
    renderAsking();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(reportError).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Confirm' })).toHaveProperty('disabled', false),
    );
  });
});
