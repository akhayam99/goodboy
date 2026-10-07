// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ProviderRunId, TurnState, WorkflowRunId } from '@goodboy/types';

const { listArtifactRevisions } = vi.hoisted(() => ({ listArtifactRevisions: vi.fn() }));

vi.mock('../../artifacts', () => ({ listArtifactRevisions }));

import { useAppStore } from '../../../../store';
import { agentPlace, sessionPlace } from '../../../../store/slices/navigation/place';
import type { ApprovePlanResult } from '../../../../store/slices/workflows/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import { isUserStart } from '../../../../shared/lib/userStarts';
import {
  PLAN_FIXTURE_AT,
  PLAN_FIXTURE_ID,
  PLAN_FIXTURE_PLANNER,
  PLAN_FIXTURE_SESSION,
} from '../../../../test/planFixtures';
import {
  PLAN_IMPLEMENTER,
  PLAN_RUN_ID,
  aPlanDraft,
  aPlannerQuestion,
  seedPlanDrawer,
  type PlanDrawerSeed,
} from '../../../../test/planDrawerFixtures';
import { ArtifactDocumentDrawer } from './index';

const REVISING_REASON = 'The planner is revising this plan';

const running = (runId: string): TurnState => ({
  kind: 'running',
  runId: runId as ProviderRunId,
  startedAt: PLAN_FIXTURE_AT,
});

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

const seedAndRender = (seed: PlanDrawerSeed = {}) => {
  seedPlanDrawer(seed);
  return renderDrawer();
};

const filledButtons = (): ReadonlyArray<string> =>
  Array.from(document.querySelectorAll('[data-filled="true"]')).map(
    (button) => button.textContent ?? '',
  );

const toolbarButtons = (): ReadonlyArray<string> =>
  Array.from(screen.getByTestId('plan-drawer-toolbar').querySelectorAll('button')).map(
    (button) => button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '',
  );

const stubApprove = (result: ApprovePlanResult) => {
  const approve = vi.fn(async () => result);
  useAppStore.setState({ approveWorkflowRunPlan: approve });
  return approve;
};

const openRunPageWithDrawer = () => {
  useAppStore.setState({
    activeLens: { [PLAN_FIXTURE_SESSION]: 'workflows' },
    focusedWorkflowRunId: { [PLAN_FIXTURE_SESSION]: PLAN_RUN_ID },
    drawer: {
      kind: 'artifact-document',
      sessionId: PLAN_FIXTURE_SESSION,
      payload: { artifactId: PLAN_FIXTURE_ID, revision: null },
    },
  });
};

beforeEach(() => {
  listArtifactRevisions.mockReset();
  listArtifactRevisions.mockResolvedValue([]);
});

afterEach(cleanup);

describe('plan document drawer header', () => {
  it('shows the title, then a second row with the state, the version and the plan', () => {
    seedAndRender();

    const frame = screen.getByRole('region', { name: 'Retry-safe webhook credits' });
    const toolbar = frame.querySelector('[data-drawer-toolbar]');
    expect(toolbar?.textContent).toContain('v2');
    expect(within(frame).getByTestId('artifact-state-chip').textContent).toContain('Ready to run');
    expect(toolbar?.contains(screen.getByRole('button', { name: 'Close the plan' }))).toBe(false);
    expect(screen.getByTestId('plan-drawer-body').textContent).toContain(
      'Retried webhooks must never post a second credit.',
    );
  });

  it('puts the one primary, Edit and the overflow on the second row', () => {
    seedAndRender({ run: 'held' });

    const toolbar = screen.getByTestId('plan-drawer-toolbar');
    expect(within(toolbar).getByTestId('plan-primary').textContent).toBe('Approve');
    expect(within(toolbar).getByRole('button', { name: 'Edit' })).toBeDefined();
    expect(within(toolbar).getByRole('button', { name: 'More plan actions' })).toBeDefined();
    expect(toolbarButtons()).toEqual(['Approve', 'Edit', 'More plan actions']);
  });

  it('has exactly one filled button for a plan a run holds for', () => {
    seedAndRender({ run: 'held' });

    expect(filledButtons()).toEqual(['Approve']);
  });

  it('has exactly one filled button for a plan whose run feeds its next step', () => {
    seedAndRender({ run: 'feeding' });

    expect(filledButtons()).toEqual(['Approve']);
  });

  it('has exactly one filled button, Run plan, for a session plan', () => {
    seedAndRender({ run: 'none' });

    expect(filledButtons()).toEqual(['Run plan']);
  });

  it('keeps the one button, off and with its reason printed beside it, while the planner revises', () => {
    seedAndRender({ run: 'held', turn: running('run-2') });

    expect(filledButtons()).toEqual(['Approve']);
    const primary = screen.getByTestId('plan-primary');
    expect(primary.hasAttribute('disabled')).toBe(true);
    expect(primary.getAttribute('title')).toBe(REVISING_REASON);
    expect(screen.getByTestId('plan-drawer-reason').textContent).toBe(REVISING_REASON);
  });

  it('has no button for a plan that already ran', () => {
    seedAndRender({ status: 'consumed' });

    expect(screen.queryByTestId('plan-primary')).toBeNull();
    expect(filledButtons()).toEqual([]);
  });

  it('has no button for a plan its run took already', () => {
    seedAndRender({ run: 'took' });

    expect(screen.queryByTestId('plan-primary')).toBeNull();
  });

  it('makes Send the one filled button and turns the header primary secondary with unsent comments', async () => {
    seedAndRender({ run: 'held', drafts: [aPlanDraft()] });

    await screen.findByTestId('plan-comment-bar');
    expect(filledButtons()).toEqual(['Send to planner']);
    expect(screen.getByTestId('plan-primary').getAttribute('data-filled')).toBe('false');
    expect(screen.queryByTestId('plan-bar-approve')).toBeNull();
  });

  it('moves to Artifacts only through Open in Artifacts in the overflow', () => {
    seedPlanDrawer();
    const navigations: unknown[] = [];
    useAppStore.setState({ navigate: (request) => navigations.push(request) });
    renderDrawer();
    expect(navigations).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'More plan actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open in Artifacts' }));

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

  it('expands to one row and collapses again, remembered for the session', () => {
    seedAndRender();

    fireEvent.click(screen.getByRole('button', { name: 'More plan actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Expand' }));
    expect(useAppStore.getState().documentDrawerExpanded[PLAN_FIXTURE_SESSION]).toBe(true);
    expect(
      screen
        .getByRole('region', { name: 'Retry-safe webhook credits' })
        .querySelector('[data-drawer-toolbar]'),
    ).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'More plan actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Collapse' }));
    expect(useAppStore.getState().documentDrawerExpanded[PLAN_FIXTURE_SESSION]).toBe(false);
  });

  it('centres the body on the reading measure only while expanded', () => {
    seedPlanDrawer();
    renderDrawer();
    expect(screen.getByTestId('plan-drawer').closest('[data-page-column]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'More plan actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Expand' }));

    const column = screen.getByTestId('plan-drawer').closest('[data-page-column]');
    expect(column?.getAttribute('data-width')).toBe('measure');
  });

  it('copies the plan from the overflow', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    seedAndRender();

    fireEvent.click(screen.getByRole('button', { name: 'More plan actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy markdown' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  });

  it('closes with its X and with Escape', () => {
    seedPlanDrawer();
    const onClose = vi.fn();
    renderDrawer({ onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Close the plan' }));
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('reads an earlier version from the revisions and offers the current one', async () => {
    seedPlanDrawer({ revision: 2 });
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
    expect(screen.queryByTestId('plan-primary')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Open v2' }));
    expect(useAppStore.getState().drawer).toEqual({
      kind: 'artifact-document',
      sessionId: PLAN_FIXTURE_SESSION,
      payload: { artifactId: PLAN_FIXTURE_ID, revision: null },
    });
  });
});

describe('approving from the drawer', () => {
  it('asks inline about unsent comments, and approves once it is confirmed', async () => {
    seedPlanDrawer({ run: 'held', drafts: [aPlanDraft(), aPlanDraft({ id: 'comment-2' })] });
    const approve = stubApprove({ kind: 'approved', next: 'continues', agentId: null });
    renderDrawer();

    fireEvent.click(screen.getByTestId('plan-primary'));

    expect(approve).not.toHaveBeenCalled();
    const question = screen.getByRole('group', {
      name: '2 comments are not sent. Approve anyway?',
    });
    fireEvent.click(within(question).getByRole('button', { name: 'Approve anyway' }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith(PLAN_FIXTURE_SESSION, PLAN_RUN_ID));
  });

  it('keeps the plan unapproved when the question is cancelled', () => {
    seedPlanDrawer({ run: 'held', drafts: [aPlanDraft()] });
    const approve = stubApprove({ kind: 'approved', next: 'continues', agentId: null });
    renderDrawer();

    fireEvent.click(screen.getByTestId('plan-primary'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(approve).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: /not sent/ })).toBeNull();
  });

  it('marks the start as the user own before the store approves', async () => {
    const runId = 'run-own-start' as WorkflowRunId;
    seedPlanDrawer({ run: 'held', runId });
    const seen: boolean[] = [];
    useAppStore.setState({
      approveWorkflowRunPlan: async () => {
        seen.push(isUserStart({ key: runId }));
        return { kind: 'approved', next: 'continues', agentId: null };
      },
    });
    renderDrawer();

    fireEvent.click(screen.getByTestId('plan-primary'));

    await waitFor(() => expect(seen).toEqual([true]));
  });

  it('closes the drawer over the run page and raises one toast without a Follow action', async () => {
    seedPlanDrawer({ run: 'held' });
    stubApprove({ kind: 'approved', next: 'continues', agentId: null });
    useAppStore.getState().navigate({
      to: sessionPlace({
        sessionId: PLAN_FIXTURE_SESSION,
        lens: 'workflows',
        target: { kind: 'run', runId: PLAN_RUN_ID },
      }),
    });
    openRunPageWithDrawer();
    renderDrawer();

    fireEvent.click(screen.getByTestId('plan-primary'));

    await waitFor(() => expect(useAppStore.getState().drawer).toBeNull());
    expect(await screen.findAllByText('Plan approved')).toHaveLength(1);
    expect(screen.getByText('The run goes on')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Follow the run' })).toBeNull();
  });

  it('names the step that started, and keeps the drawer elsewhere with a Follow the run action', async () => {
    seedPlanDrawer({ run: 'held' });
    stubApprove({ kind: 'approved', next: 'started', agentId: PLAN_IMPLEMENTER });
    useAppStore.setState({
      drawer: {
        kind: 'artifact-document',
        sessionId: PLAN_FIXTURE_SESSION,
        payload: { artifactId: PLAN_FIXTURE_ID, revision: null },
      },
    });
    renderDrawer();

    fireEvent.click(screen.getByTestId('plan-primary'));

    expect(await screen.findByText('Implement started')).toBeDefined();
    expect(screen.getAllByText('Plan approved')).toHaveLength(1);
    expect(useAppStore.getState().drawer).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Follow the run' }));
    expect(useAppStore.getState().activeLens[PLAN_FIXTURE_SESSION]).toBe('workflows');
    expect(useAppStore.getState().focusedWorkflowRunId[PLAN_FIXTURE_SESSION]).toBe(PLAN_RUN_ID);
  });

  it('raises nothing and closes nothing when there was nothing to approve', async () => {
    seedPlanDrawer({ run: 'held' });
    const approve = stubApprove({ kind: 'noop', reason: 'not-held' });
    openRunPageWithDrawer();
    renderDrawer();

    fireEvent.click(screen.getByTestId('plan-primary'));

    await waitFor(() => expect(approve).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Plan approved')).toBeNull();
    expect(useAppStore.getState().drawer).not.toBeNull();
  });

  it('reports a failure and keeps the drawer open', async () => {
    seedPlanDrawer({ run: 'held' });
    stubApprove({ kind: 'failed', message: 'The planner is revising this plan' });
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({ reportError });
    openRunPageWithDrawer();
    renderDrawer();

    fireEvent.click(screen.getByTestId('plan-primary'));

    await waitFor(() => expect(reportError).toHaveBeenCalledTimes(1));
    expect(reportError).toHaveBeenCalledWith({
      title: "Couldn't approve the plan",
      error: new Error('The planner is revising this plan'),
      sessionId: PLAN_FIXTURE_SESSION,
    });
    expect(screen.queryByText('Plan approved')).toBeNull();
    expect(useAppStore.getState().drawer).not.toBeNull();
  });

  it('approves a plan whose run feeds its next step through the run, and says what started', async () => {
    seedPlanDrawer({ run: 'feeding' });
    const runPlan = vi.fn(async () => ({
      kind: 'started' as const,
      agentId: PLAN_IMPLEMENTER,
      scope: 'workflow' as const,
    }));
    useAppStore.setState({ runPlan });
    renderDrawer();

    fireEvent.click(screen.getByTestId('plan-primary'));

    expect(await screen.findByText('Implement started')).toBeDefined();
    expect(runPlan).toHaveBeenCalledWith(PLAN_FIXTURE_SESSION, PLAN_FIXTURE_ID);
  });

  it('runs a session plan and keeps the Run plan toast of the follow unit', async () => {
    seedPlanDrawer({ run: 'none' });
    const runPlan = vi.fn(async () => ({
      kind: 'started' as const,
      agentId: PLAN_IMPLEMENTER,
      scope: 'session' as const,
    }));
    useAppStore.setState({ runPlan });
    renderDrawer();

    fireEvent.click(screen.getByTestId('plan-primary'));

    expect(await screen.findByText('Implementer started')).toBeDefined();
    expect(screen.queryByText('Plan approved')).toBeNull();
  });
});

describe('comment and re-plan', () => {
  it('says revising once in the chip and once in the reason, with no third line in the body', () => {
    seedAndRender({ run: 'held', turn: running('run-2') });

    expect(screen.getByTestId('plan-drawer-body').getAttribute('data-revising')).toBe('true');
    expect(screen.queryByTestId('plan-drawer-state-line')).toBeNull();
    expect(screen.getAllByText(/Revising to v3/)).toHaveLength(1);
    expect(screen.getAllByText(REVISING_REASON)).toHaveLength(1);
    expect(screen.getByTestId('artifact-state-chip').textContent).toContain('Revising to v3');
  });

  it('keeps the Writing a new version line for a plan that already ran', () => {
    seedAndRender({ status: 'consumed', run: 'took', turn: running('run-2') });

    const line = screen.getByTestId('plan-drawer-state-line');
    expect(line.textContent).toContain('Writing a new version');
    expect(screen.getByTestId('plan-drawer-body').contains(line)).toBe(false);
  });

  it('says v3 and who wrote it once a new version lands', async () => {
    seedPlanDrawer({ revision: 3 });
    listArtifactRevisions.mockResolvedValue([
      { revision: 2, author: 'user' },
      { revision: 3, author: 'agent' },
    ]);
    renderDrawer();

    expect(screen.getByTestId('plan-drawer-version').textContent).toBe('v3');
    expect((await screen.findByTestId('plan-drawer-note')).textContent).toBe(
      'v3 · Revised by planner',
    );
  });

  it('says a hand edit was yours', async () => {
    seedPlanDrawer({ revision: 3 });
    listArtifactRevisions.mockResolvedValue([{ revision: 3, author: 'user' }]);
    renderDrawer();

    expect((await screen.findByTestId('plan-drawer-note')).textContent).toBe('v3 · Edited by you');
  });

  it('shows the answer line and keeps the comments open when the planner changed nothing', async () => {
    seedPlanDrawer({ run: 'held', drafts: [aPlanDraft()] });
    const sendArtifactComments = vi.fn(async () => {
      useAppStore.setState((state) => ({
        artifactComments: {
          ...state.artifactComments,
          [PLAN_FIXTURE_SESSION]: (state.artifactComments[PLAN_FIXTURE_SESSION] ?? []).map(
            (comment) => ({ ...comment, status: 'open' as const }),
          ),
        },
      }));
      return { kind: 'unchanged' as const };
    });
    const navigations: unknown[] = [];
    useAppStore.setState({
      sendArtifactComments,
      navigate: (request) => navigations.push(request),
    });
    renderDrawer();

    fireEvent.click(await screen.findByRole('button', { name: 'Send to planner' }));

    expect(await screen.findByText('The planner answered without changing the plan')).toBeDefined();
    expect(screen.getAllByTestId('plan-comment')).toHaveLength(1);
    expect(screen.getByTestId('plan-comment').getAttribute('data-status')).toBe('open');
    fireEvent.click(screen.getByRole('button', { name: 'Open the reply' }));
    expect(navigations).toEqual([
      { to: agentPlace({ sessionId: PLAN_FIXTURE_SESSION, agentId: PLAN_FIXTURE_PLANNER }) },
    ]);
  });

  it('shows the planner question at the top with Answer, and makes the bar wait', async () => {
    seedPlanDrawer({
      run: 'held',
      drafts: [aPlanDraft()],
      questions: [aPlannerQuestion()],
      turn: { kind: 'idle', lastActivityAt: PLAN_FIXTURE_AT },
    });
    renderDrawer();

    const question = await screen.findByTestId('plan-drawer-question');
    expect(question.textContent).toContain('Should refunds older than 90 days stay in the export?');
    expect(within(question).getByRole('button', { name: 'Answer' })).toBeDefined();
    const body = screen.getByTestId('plan-drawer');
    expect(body.firstElementChild).toBe(question);
    const send = screen.getByRole('button', { name: 'Send to planner' });
    expect(send.hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('plan-comment-note').textContent).toBe(
      'The planner asked a question. Answer it first.',
    );
  });

  it('says waiting for your answer, never revising, while the planner asks', async () => {
    seedPlanDrawer({
      run: 'held',
      questions: [aPlannerQuestion()],
      turn: { kind: 'idle', lastActivityAt: PLAN_FIXTURE_AT },
    });
    renderDrawer();

    await screen.findByTestId('plan-drawer-question');
    const chip = screen.getByTestId('artifact-state-chip');
    expect(chip.textContent).toContain('Needs you');
    expect(screen.getByTestId('artifact-state-detail').textContent).toBe('waiting for your answer');
    expect(screen.queryByText(/Revising/)).toBeNull();
    expect(screen.queryByTestId('plan-drawer-state-line')).toBeNull();
    expect(screen.getByTestId('plan-drawer-body').getAttribute('data-revising')).toBe('false');
  });

  it('holds Approve off with the question reason beside it while the planner asks', async () => {
    seedPlanDrawer({
      run: 'held',
      questions: [aPlannerQuestion()],
      turn: { kind: 'idle', lastActivityAt: PLAN_FIXTURE_AT },
    });
    renderDrawer();

    await screen.findByTestId('plan-drawer-question');
    const primary = screen.getByTestId('plan-primary');
    expect(primary.hasAttribute('disabled')).toBe(true);
    expect(primary.getAttribute('title')).toBe('The planner asked a question. Answer it first.');
    expect(screen.getByTestId('plan-drawer-reason').textContent).toBe(
      'The planner asked a question. Answer it first.',
    );
  });

  it('lets Approve through when the open question belongs to another agent', async () => {
    seedPlanDrawer({
      run: 'held',
      questions: [aPlannerQuestion({ createdByAgentId: PLAN_IMPLEMENTER })],
      turn: { kind: 'idle', lastActivityAt: PLAN_FIXTURE_AT },
    });
    renderDrawer();

    expect(screen.getByTestId('plan-primary').hasAttribute('disabled')).toBe(false);
  });
});

describe('parts in the drawer body', () => {
  const withPartsSection = () => {
    seedPlanDrawer({ parts: 3 });
    useAppStore.setState((state) => ({
      sessionPlans: {
        ...state.sessionPlans,
        [PLAN_FIXTURE_SESSION]: (state.sessionPlans[PLAN_FIXTURE_SESSION] ?? []).map((plan) => ({
          ...plan,
          bodyMd:
            '## Goal\nRetried webhooks must never post a second credit.\n\n## Parts\n1. Part 1\n2. Part 2\n3. Part 3\n\n## Risks\nA retry can still race.',
        })),
      },
    }));
    return renderDrawer();
  };

  it('shows the parts once when the planner wrote them as clusters and as a markdown section', () => {
    withPartsSection();

    const body = screen.getByTestId('plan-body');
    expect(within(body).getAllByRole('heading', { name: /^Parts/ })).toHaveLength(1);
    expect(within(body).getAllByText('Part 1')).toHaveLength(1);
    expect(body.textContent).toContain('A retry can still race.');
  });

  it('keeps a Parts section when no structured parts exist', () => {
    seedPlanDrawer({ parts: 0 });
    useAppStore.setState((state) => ({
      sessionPlans: {
        ...state.sessionPlans,
        [PLAN_FIXTURE_SESSION]: (state.sessionPlans[PLAN_FIXTURE_SESSION] ?? []).map((plan) => ({
          ...plan,
          bodyMd:
            '## Goal\nRetried webhooks must never post a second credit.\n\n## Parts\n1. Only part',
        })),
      },
    }));
    renderDrawer();

    expect(within(screen.getByTestId('plan-body')).getByText('Only part')).toBeDefined();
  });
});

describe('the bar in the drawer', () => {
  it('shows the draft under its text and the Send bar', async () => {
    seedAndRender({ drafts: [aPlanDraft()] });

    await waitFor(() =>
      expect(screen.getByTestId('plan-drawer-body').textContent).toContain(
        'Say which webhooks retry',
      ),
    );
    expect(screen.getByTestId('plan-comment-bar').textContent).toContain('1 comment');
    expect(screen.getByRole('button', { name: 'Send to planner' }).hasAttribute('disabled')).toBe(
      false,
    );
    expect(screen.queryByTestId('plan-bar-approve')).toBeNull();
  });

  it('says Approve once, in the header, and keeps only the hint in the bar with no comment', () => {
    seedAndRender({ run: 'held' });

    const bar = screen.getByTestId('plan-comment-bar');
    expect(within(bar).queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(within(bar).queryByRole('button', { name: 'Send to planner' })).toBeNull();
    expect(bar.textContent).toContain('Select text or click a block to comment');
    expect(screen.getAllByRole('button', { name: 'Approve' })).toHaveLength(1);
  });

  it('turns Send off with the revising reason while the planner revises', () => {
    seedAndRender({ run: 'held', drafts: [aPlanDraft()], turn: running('run-2') });

    expect(screen.getByRole('button', { name: 'Send to planner' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByTestId('plan-comment-note').textContent).toBe(REVISING_REASON);
    expect(screen.queryByTestId('plan-bar-approve')).toBeNull();
  });
});

describe('editing the plan by hand in the drawer', () => {
  const stubSave = (result: { kind: 'saved' | 'conflict'; revision: number }) => {
    const updatePlanBody = vi.fn(async () => {
      if (result.kind === 'saved') {
        useAppStore.setState((state) => ({
          sessionArtifacts: {
            ...state.sessionArtifacts,
            [PLAN_FIXTURE_SESSION]: (state.sessionArtifacts[PLAN_FIXTURE_SESSION] ?? []).map(
              (artifact) => ({ ...artifact, revision: result.revision }),
            ),
          },
        }));
      }
      return result;
    });
    useAppStore.setState({ updatePlanBody });
    return updatePlanBody;
  };

  const startEditing = () => fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

  const edit = (text: string) =>
    fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });

  const escape = () => fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

  it('swaps the body for the markdown editor, with Save as the primary and Cancel beside it', () => {
    seedAndRender({ run: 'held' });

    startEditing();

    const textbox = screen.getByRole('textbox');
    expect((textbox as HTMLTextAreaElement).value).toBe(
      '# Retry-safe webhook credits\n\n## Goal\nRetried webhooks must never post a second credit.',
    );
    expect(screen.queryByTestId('plan-primary')).toBeNull();
    expect(screen.queryByTestId('plan-comment-bar')).toBeNull();
    expect(filledButtons()).toEqual(['Save']);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
  });

  it('saves against the revision the edit started from and says it was yours', async () => {
    seedAndRender({ revision: 2 });
    const updatePlanBody = stubSave({ kind: 'saved', revision: 3 });
    startEditing();

    edit('# Retry-safe webhook credits\n\n## Goal\nA retried webhook posts nothing.');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(updatePlanBody).toHaveBeenCalledWith(
        PLAN_FIXTURE_SESSION,
        PLAN_FIXTURE_ID,
        'Retry-safe webhook credits',
        '## Goal\nA retried webhook posts nothing.',
        2,
      ),
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    expect((await screen.findByTestId('plan-drawer-note')).textContent).toBe('v3 · Edited by you');
  });

  it('keeps your text and says the planner wrote meanwhile when the revision moved', async () => {
    seedAndRender({ revision: 2 });
    stubSave({ kind: 'conflict', revision: 3 });
    startEditing();

    edit('# Retry-safe webhook credits\n\n## Goal\nMine.');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('The planner wrote v3 meanwhile')).toBeDefined();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toContain('Mine.');
    expect(screen.getByRole('button', { name: 'Copy your text' })).toBeDefined();
    expect(screen.getByTestId('artifact-save').hasAttribute('disabled')).toBe(true);
    const version = screen.getByTestId('plan-drawer-version');
    expect(version.textContent).toBe('v2 · v3');
    expect(version.getAttribute('title')).toBe('Version 3 is available');
    expect(toolbarButtons()).toEqual(['Save', 'Cancel', 'More plan actions']);
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByTestId('plan-drawer-version').textContent).toBe('v2');
  });

  it('copies your text from the conflict notice', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    seedAndRender({ revision: 2 });
    stubSave({ kind: 'conflict', revision: 3 });
    startEditing();

    edit('# Retry-safe webhook credits\n\n## Goal\nMine.');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Copy your text' }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('# Retry-safe webhook credits\n\n## Goal\nMine.'),
    );
  });

  it.each([
    {
      name: 'the planner revises',
      seed: { run: 'held', turn: running('run-2') } satisfies PlanDrawerSeed,
      reason: REVISING_REASON,
    },
    {
      name: 'comments are unsent',
      seed: { run: 'held', drafts: [aPlanDraft()] } satisfies PlanDrawerSeed,
      reason: 'Send or discard your 1 comment first',
    },
    {
      name: 'the plan runs as parallel parts',
      seed: { run: 'held', parts: 3 } satisfies PlanDrawerSeed,
      reason: 'This plan runs as 3 parallel parts. Ask the planner to change it.',
    },
  ])('disables Edit with its reason when $name', ({ seed, reason }) => {
    seedAndRender(seed);

    const button = screen.getByRole('button', { name: 'Edit' });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('title')).toBe(reason);
  });

  it('prints the parallel parts reason under the toolbar', () => {
    seedAndRender({ run: 'held', parts: 3 });

    expect(screen.getByTestId('plan-drawer-reason').textContent).toBe(
      'This plan runs as 3 parallel parts. Ask the planner to change it.',
    );
  });

  it('leaves edit mode on Escape without closing the drawer, and asks first when dirty', () => {
    seedPlanDrawer();
    const onClose = vi.fn();
    renderDrawer({ onClose });
    startEditing();

    escape();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    startEditing();
    edit('# Retry-safe webhook credits\n\n## Goal\nChanged.');
    escape();
    expect(screen.getByRole('group', { name: 'Discard your edit?' })).toBeDefined();
    expect(screen.getByRole('textbox')).toBeDefined();
    expect(onClose).not.toHaveBeenCalled();

    escape();
    expect(screen.queryByRole('group', { name: 'Discard your edit?' })).toBeNull();
    expect(screen.getByRole('textbox')).toBeDefined();

    escape();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    escape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks before Cancel throws a changed edit away', () => {
    seedAndRender();
    startEditing();
    edit('# Retry-safe webhook credits\n\n## Goal\nChanged.');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('group', { name: 'Discard your edit?' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('refuses a save without a title', async () => {
    seedAndRender();
    const updatePlanBody = stubSave({ kind: 'saved', revision: 3 });
    startEditing();

    edit('');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'The first line is the plan title. Add one before saving.',
    );
    expect(updatePlanBody).not.toHaveBeenCalled();
  });
});
