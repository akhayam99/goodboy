// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  ArtifactComment,
  PlanArtifact,
  PlanWithCount,
  ProviderRunId,
  StepId,
  TurnState,
  WorkflowRunId,
} from '@goodboy/types';
import { anAgent, aSession, aWorkflowRun } from '@goodboy/types/testing';

const { listArtifactRevisions } = vi.hoisted(() => ({ listArtifactRevisions: vi.fn() }));

vi.mock('../../artifacts', () => ({ listArtifactRevisions }));

import { useAppStore } from '../../../../store';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  PLAN_FIXTURE_AT,
  PLAN_FIXTURE_ID,
  PLAN_FIXTURE_PLANNER,
  PLAN_FIXTURE_SESSION,
  aPlan,
  aStoredPlan,
} from '../../../../test/planFixtures';
import { ArtifactDocumentDrawer } from './index';

const seed = ({
  revision = 2,
  status = 'active',
  turn = { kind: 'idle', lastActivityAt: PLAN_FIXTURE_AT },
}: {
  readonly revision?: number;
  readonly status?: PlanWithCount['status'];
  readonly turn?: TurnState;
}) => {
  const plan = aPlan({ status, consumptionCount: status === 'consumed' ? 1 : 0 });
  const stored: PlanArtifact = aStoredPlan({ revision, status }, plan);
  useAppStore.setState({
    sessionPlans: { [PLAN_FIXTURE_SESSION]: [plan] },
    sessionArtifacts: { [PLAN_FIXTURE_SESSION]: [stored] },
    sessionPhaseRuns: {
      [PLAN_FIXTURE_SESSION]: [
        anAgent({ id: PLAN_FIXTURE_PLANNER, sessionId: PLAN_FIXTURE_SESSION, name: 'Planner' }),
      ],
    },
    sessionOpenQuestions: {},
    agentTurnState: { [PLAN_FIXTURE_PLANNER]: turn },
    documentDrawerExpanded: {},
    drawer: null,
    artifactComments: {},
    loadArtifactComments: async () => undefined,
  });
};

const renderDrawer = ({
  revision = null,
  onClose = () => undefined,
}: { readonly revision?: number | null; readonly onClose?: () => void } = {}) =>
  render(
    <ToastProvider>
      <ArtifactDocumentDrawer
        sessionId={PLAN_FIXTURE_SESSION}
        artifactId={PLAN_FIXTURE_ID}
        revision={revision}
        onClose={onClose}
      />
    </ToastProvider>,
  );

beforeEach(() => {
  listArtifactRevisions.mockReset();
});

afterEach(cleanup);

describe('plan document drawer', () => {
  it('shows the title, the version, the state and the plan', () => {
    seed({});
    renderDrawer();

    const frame = screen.getByRole('region', { name: 'Retry-safe webhook credits' });
    expect(frame.textContent).toContain('v2');
    expect(screen.getByTestId('artifact-state-chip').textContent).toContain('Ready to run');
    expect(screen.getByTestId('plan-drawer-body').textContent).toContain(
      'Retried webhooks must never post a second credit.',
    );
  });

  it('dims the plan and blocks Run plan with the reason while the planner revises', () => {
    seed({
      turn: { kind: 'running', runId: 'run-2' as ProviderRunId, startedAt: PLAN_FIXTURE_AT },
    });
    renderDrawer();

    expect(screen.getByTestId('artifact-state-chip').textContent).toContain('Revising to v3');
    expect(screen.getByTestId('plan-drawer-body').getAttribute('data-revising')).toBe('true');
    const run = screen.getByTestId('plan-run');
    expect(run.hasAttribute('disabled')).toBe(true);
    expect(run.getAttribute('title')).toBe('The planner is revising this plan');
  });

  it('does not offer Run plan for a plan that already ran', () => {
    seed({ status: 'consumed' });
    renderDrawer();

    expect(screen.queryByTestId('plan-run')).toBeNull();
  });

  it('moves to Artifacts only through Open in Artifacts', () => {
    seed({});
    const navigations: unknown[] = [];
    useAppStore.setState({ navigate: (request) => navigations.push(request) });
    renderDrawer();
    expect(navigations).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Open in Artifacts' }));

    expect(navigations).toEqual([
      {
        to: sessionPlace({
          sessionId: PLAN_FIXTURE_SESSION,
          lens: 'plans',
          target: { kind: 'artifact', artifactId: PLAN_FIXTURE_ID },
        }),
      },
    ]);
  });

  it('expands to the full pane and collapses again, remembered for the session', () => {
    seed({});
    renderDrawer();

    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    expect(useAppStore.getState().documentDrawerExpanded[PLAN_FIXTURE_SESSION]).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
    expect(useAppStore.getState().documentDrawerExpanded[PLAN_FIXTURE_SESSION]).toBe(false);
  });

  it('closes with its X and with Escape', () => {
    seed({});
    const onClose = vi.fn();
    renderDrawer({ onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Close the plan' }));
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('reads an earlier version from the revisions and offers the current one', async () => {
    seed({ revision: 2 });
    listArtifactRevisions.mockResolvedValue([
      {
        artifactId: PLAN_FIXTURE_ID,
        revision: 1,
        title: 'Retry-safe webhook credits',
        sourceText: '## Goal\nFirst draft of the retry plan.',
        metadata: {},
        author: 'agent',
        ask: null,
        createdAt: PLAN_FIXTURE_AT,
      },
    ]);
    renderDrawer({ revision: 1 });

    await waitFor(() =>
      expect(screen.getByTestId('plan-drawer-past').textContent).toContain(
        'First draft of the retry plan.',
      ),
    );
    expect(screen.getByTestId('plan-drawer-past').textContent).toContain(
      'Version 1, replaced by v2',
    );
    expect(screen.queryByTestId('plan-run')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Open v2' }));
    expect(useAppStore.getState().drawer).toEqual({
      kind: 'artifact-document',
      sessionId: PLAN_FIXTURE_SESSION,
      payload: { artifactId: PLAN_FIXTURE_ID, revision: null },
    });
  });

  describe('comments on the plan in the drawer', () => {
    const RUN_ID = 'run-harborline' as WorkflowRunId;
    const DRAFT: ArtifactComment = {
      id: 'comment-1',
      sessionId: PLAN_FIXTURE_SESSION,
      artifactId: PLAN_FIXTURE_ID,
      revision: 2,
      anchor: {
        kind: 'block',
        order: 0,
        text: 'Retried webhooks must never post a second credit.',
      },
      body: 'Say which webhooks retry',
      status: 'draft',
      sentTurnId: null,
      createdAt: PLAN_FIXTURE_AT,
      updatedAt: PLAN_FIXTURE_AT,
    };

    const seedWithDraft = ({
      turn,
      isHeld = false,
    }: {
      readonly turn?: TurnState;
      readonly isHeld?: boolean;
    }) => {
      seed({ turn });
      useAppStore.setState({
        artifactComments: { [PLAN_FIXTURE_SESSION]: [DRAFT] },
        sessions: [
          aSession({
            id: PLAN_FIXTURE_SESSION,
            workflowRuns: [
              aWorkflowRun({
                id: RUN_ID,
                orchestrationStop: isHeld
                  ? { kind: 'plan-approval', message: 'The plan is ready.' }
                  : undefined,
              }),
            ],
          }),
        ],
        sessionPhaseRuns: {
          [PLAN_FIXTURE_SESSION]: [
            anAgent({
              id: PLAN_FIXTURE_PLANNER,
              sessionId: PLAN_FIXTURE_SESSION,
              name: 'Planner',
              workflowRunId: RUN_ID,
              stepId: 'plan' as StepId,
            }),
          ],
        },
      });
    };

    it('shows the draft under its text and the Send bar', async () => {
      seedWithDraft({});
      renderDrawer();

      await waitFor(() =>
        expect(screen.getByTestId('plan-drawer-body').textContent).toContain(
          'Say which webhooks retry',
        ),
      );
      expect(screen.getByTestId('plan-comment-bar').textContent).toContain('1 comment');
      const send = screen.getByRole('button', { name: 'Send to planner' });
      expect(send.hasAttribute('disabled')).toBe(false);
      expect(screen.queryByRole('button', { name: 'Approve plan' })).toBeNull();
    });

    it('puts Approve plan next to Send while the run waits for approval', () => {
      seedWithDraft({ isHeld: true });
      renderDrawer();

      expect(screen.getByRole('button', { name: 'Approve plan' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Send to planner' })).toBeDefined();
    });

    it('turns Send off with the revising reason while the planner revises', () => {
      seedWithDraft({
        turn: { kind: 'running', runId: 'run-2' as ProviderRunId, startedAt: PLAN_FIXTURE_AT },
        isHeld: true,
      });
      renderDrawer();

      const send = screen.getByRole('button', { name: 'Send to planner' });
      expect(send.hasAttribute('disabled')).toBe(true);
      expect(screen.getByTestId('plan-comment-note').textContent).toBe(
        'The planner is revising this plan',
      );
      expect(screen.queryByRole('button', { name: 'Approve plan' })).toBeNull();
    });
  });
});
