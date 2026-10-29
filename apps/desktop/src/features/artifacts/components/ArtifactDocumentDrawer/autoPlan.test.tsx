// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const { listArtifactRevisions, approveAutoPlan } = vi.hoisted(() => ({
  listArtifactRevisions: vi.fn(),
  approveAutoPlan: vi.fn(),
}));

vi.mock('../../artifacts', () => ({ listArtifactRevisions }));
vi.mock('../../../auto/plan/approveAutoPlan', () => ({ approveAutoPlan }));

import { anAgent } from '@goodboy/types/testing';
import { useAppStore } from '../../../../store';
import { agentPlace } from '../../../../store/slices/navigation/place';
import { ToastProvider } from '../../../../shared/components/Toast';
import { PLAN_FIXTURE_ID, PLAN_FIXTURE_SESSION } from '../../../../test/planFixtures';
import { seedPlanDrawer } from '../../../../test/planDrawerFixtures';
import { aDelegation, aPlanRow, aView, FIXTURE_ROOT } from '../../../auto/testing/autoViewFixtures';
import { ArtifactDocumentDrawer } from './index';

type SeedParams = {
  readonly approvalState?: 'needs_approval' | 'approved' | 'revising';
  readonly approvedRevision?: number | null;
  readonly openRevise?: string | null;
};

const seedAutoPlan = ({
  approvalState = 'needs_approval',
  approvedRevision = null,
  openRevise = null,
}: SeedParams = {}): void => {
  seedPlanDrawer({});
  const row = aPlanRow({ approvalState, approvedRevision, openRevise, revision: 2 });
  useAppStore.setState({
    sessionPhaseRuns: {
      [PLAN_FIXTURE_SESSION]: [anAgent({ id: FIXTURE_ROOT, sessionId: PLAN_FIXTURE_SESSION })],
    },
    autoTreeViews: {
      [PLAN_FIXTURE_SESSION]: [
        aView({
          phase: 'waiting',
          artifacts: [
            {
              ...row,
              artifact: { ...row.artifact, artifactId: PLAN_FIXTURE_ID },
            },
          ],
          delegations: [
            aDelegation({
              key: 'planner',
              role: 'planner',
              state: 'settled',
              outcome: 'completed',
            }),
          ],
        }),
      ],
    },
    loadAutoTrees: async () => undefined,
    sendTurn: async () => ({ blockedOverBudget: false }),
  });
};

const renderDrawer = () =>
  render(
    <ToastProvider>
      <ArtifactDocumentDrawer
        sessionId={PLAN_FIXTURE_SESSION}
        artifactId={PLAN_FIXTURE_ID}
        revision={null}
        onClose={() => undefined}
      />
    </ToastProvider>,
  );

beforeEach(() => {
  listArtifactRevisions.mockReset();
  listArtifactRevisions.mockResolvedValue([]);
  approveAutoPlan.mockReset();
});

afterEach(cleanup);

describe('the plan drawer of an Auto plan', () => {
  it('puts Needs approval, the version, Ask for changes and Approve plan on the second row', () => {
    seedAutoPlan();

    renderDrawer();

    const toolbar = screen.getByTestId('auto-plan-toolbar');
    expect(within(toolbar).getByText('Needs approval')).toBeDefined();
    expect(within(toolbar).getByText('v2')).toBeDefined();
    expect(within(toolbar).getByRole('button', { name: /Ask for changes/ })).toBeDefined();
    expect(within(toolbar).getByRole('button', { name: /Approve plan/ })).toBeDefined();
    expect(screen.queryByTestId('plan-drawer-toolbar')).toBeNull();
  });

  it('approves the version it shows and closes the drawer', async () => {
    seedAutoPlan();
    approveAutoPlan.mockResolvedValue({ kind: 'approved', revision: 2 });
    renderDrawer();

    fireEvent.click(screen.getByRole('button', { name: /Approve plan/ }));

    await waitFor(() => expect(approveAutoPlan).toHaveBeenCalledOnce());
    expect(approveAutoPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactId: PLAN_FIXTURE_ID,
        expectedRevision: 2,
        rootAgentId: FIXTURE_ROOT,
      }),
    );
    await waitFor(() => expect(useAppStore.getState().drawer).toBeNull());
  });

  it('keeps the drawer open and reports a refused approval', async () => {
    seedAutoPlan();
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({ reportError });
    approveAutoPlan.mockResolvedValue({
      kind: 'refused',
      code: 'stale_revision',
      message: 'A newer version arrived. Review it before approving.',
    });
    useAppStore.setState({
      drawer: {
        kind: 'artifact-document',
        sessionId: PLAN_FIXTURE_SESSION,
        payload: { artifactId: PLAN_FIXTURE_ID, revision: null },
      },
    });
    renderDrawer();

    fireEvent.click(screen.getByRole('button', { name: /Approve plan/ }));

    await waitFor(() => expect(reportError).toHaveBeenCalledOnce());
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't approve the plan" }),
    );
    expect(useAppStore.getState().drawer).not.toBeNull();
  });

  it('approves on a second click after a refusal, with the drawer still open', async () => {
    seedAutoPlan();
    useAppStore.setState({
      reportError: vi.fn(async () => undefined),
      drawer: {
        kind: 'artifact-document',
        sessionId: PLAN_FIXTURE_SESSION,
        payload: { artifactId: PLAN_FIXTURE_ID, revision: null },
      },
    });
    approveAutoPlan.mockResolvedValueOnce({
      kind: 'refused',
      code: 'stale_revision',
      message: 'A newer version arrived. Review it before approving.',
    });
    approveAutoPlan.mockResolvedValueOnce({ kind: 'approved', revision: 2 });
    renderDrawer();

    fireEvent.click(screen.getByRole('button', { name: /Approve plan/ }));
    await waitFor(() => expect(approveAutoPlan).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Approve plan/ })).toHaveProperty(
        'disabled',
        false,
      ),
    );
    expect(useAppStore.getState().drawer).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Approve plan/ }));

    await waitFor(() => expect(approveAutoPlan).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(useAppStore.getState().drawer).toBeNull());
  });

  it('offers Tell Auto when the approval was saved but Auto was not told, and sends it again', async () => {
    seedAutoPlan();
    const sendTurn = vi.fn(async () => ({ blockedOverBudget: false }));
    useAppStore.setState({
      reportError: vi.fn(async () => undefined),
      sendTurn,
      drawer: {
        kind: 'artifact-document',
        sessionId: PLAN_FIXTURE_SESSION,
        payload: { artifactId: PLAN_FIXTURE_ID, revision: null },
      },
    });
    approveAutoPlan.mockResolvedValue({
      kind: 'told_failed',
      revision: 2,
      error: new Error('offline'),
    });
    renderDrawer();

    fireEvent.click(screen.getByRole('button', { name: /Approve plan/ }));
    const tell = await screen.findByRole('button', { name: 'Tell Auto' });
    screen.getByText('Approved, Auto did not hear it');
    expect(useAppStore.getState().drawer).not.toBeNull();
    fireEvent.click(tell);

    await waitFor(() =>
      expect(sendTurn).toHaveBeenCalledWith({
        sessionId: PLAN_FIXTURE_SESSION,
        agentId: FIXTURE_ROOT,
        content: 'Approved plan v2.',
      }),
    );
    await waitFor(() => expect(useAppStore.getState().drawer).toBeNull());
  });

  it('turns Approve plan off while the planner revises, with the reason', () => {
    seedAutoPlan({ approvalState: 'revising', openRevise: 'delegation-revise' });

    renderDrawer();

    const approve = screen.getByRole('button', { name: /Approve plan/ });
    expect(approve).toHaveProperty('disabled', true);
  });

  it('shows Approved and no actions once the shown version is approved', () => {
    seedAutoPlan({ approvalState: 'approved', approvedRevision: 2 });

    renderDrawer();

    const toolbar = screen.getByTestId('auto-plan-toolbar');
    expect(within(toolbar).getByText('Approved')).toBeDefined();
    expect(within(toolbar).queryByRole('button')).toBeNull();
  });

  it('sends Ask for changes to the chat of Auto', () => {
    seedAutoPlan();
    const navigate = vi.fn();
    useAppStore.setState({ navigate });
    renderDrawer();

    fireEvent.click(screen.getByRole('button', { name: /Ask for changes/ }));

    expect(navigate).toHaveBeenCalledWith({
      to: agentPlace({ sessionId: PLAN_FIXTURE_SESSION, agentId: FIXTURE_ROOT }),
    });
  });

  it('keeps the plan readable without Approve when the Auto agent that owned it is gone', () => {
    seedAutoPlan();
    useAppStore.setState({ sessionPhaseRuns: { [PLAN_FIXTURE_SESSION]: [] } });

    renderDrawer();

    expect(screen.queryByTestId('auto-plan-toolbar')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Approve plan' })).toBeNull();
  });

  it('keeps the plan toolbar of today for a plan that no Auto tree owns', () => {
    seedPlanDrawer({ run: 'held' });
    useAppStore.setState({ autoTreeViews: {} });

    renderDrawer();

    expect(screen.getByTestId('plan-drawer-toolbar')).toBeDefined();
    expect(screen.queryByTestId('auto-plan-toolbar')).toBeNull();
  });
});
