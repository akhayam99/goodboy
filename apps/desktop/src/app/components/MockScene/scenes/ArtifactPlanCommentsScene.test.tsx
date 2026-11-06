// @vitest-environment happy-dom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  importStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { RunPlanResult } from '../../../../store/slices/plans/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import { ArtifactPlanCommentsScene } from './ArtifactPlanCommentsScene';

type SceneProps = {
  readonly hasComments?: boolean;
  readonly hasRun?: boolean;
};

const Scene = ({ hasComments = true, hasRun = false }: SceneProps) => (
  <ToastProvider>
    <ArtifactPlanCommentsScene hasComments={hasComments} hasRun={hasRun} />
  </ToastProvider>
);

let useAppStore: StoryStore;

const stubRunPlan = () => {
  const runPlan = vi.fn(async (): Promise<RunPlanResult> => ({
    kind: 'refused',
    reason: null,
    workflowRunId: null,
  }));
  useAppStore.setState({ runPlan });
  return runPlan;
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

afterEach(cleanup);

describe('ArtifactPlanCommentsScene', () => {
  it('shows the plan with two drafts under their anchors and the bar to send them', async () => {
    render(<Scene />);

    const drafts = await screen.findAllByTestId('plan-comment');
    expect(drafts.map((draft) => within(draft).getByText('Draft').textContent)).toEqual([
      'Draft',
      'Draft',
    ]);
    const frames = screen.getAllByTestId('plan-part-comments');
    expect(frames).toHaveLength(3);
    within(frames[1] as HTMLElement).getByText(/Split the charge path/);
    expect(within(frames[0] as HTMLElement).queryByTestId('plan-comment')).toBeNull();
    expect(screen.getByText('idempotency keys').tagName).toBe('Q');
    const bar = screen.getByTestId('plan-comment-bar');
    within(bar).getByText('2 comments');
    const send = within(bar).getByRole('button', { name: 'Send to planner' });
    expect((send as HTMLButtonElement).disabled).toBe(false);
  });

  it('keeps one filled button while comments wait: Send is filled, Run is not', async () => {
    render(<Scene />);
    const run = await screen.findByTestId('artifact-action-runPlan');
    expect(run.getAttribute('data-variant')).toBe('secondary');
    expect(screen.getByTestId('plan-bar-send').getAttribute('data-variant')).toBe('primary');
    const filled = Array.from(document.querySelectorAll('[data-variant="primary"]'));
    expect(filled).toHaveLength(1);
    expect(screen.queryByTestId('plan-bar-approve')).toBeNull();
  });

  it('asks before Run while comments wait, and Run anyway runs once', async () => {
    const runPlan = stubRunPlan();
    render(<Scene />);
    await screen.findAllByTestId('plan-comment');

    fireEvent.click(screen.getByTestId('artifact-action-runPlan'));

    expect(runPlan).not.toHaveBeenCalled();
    await screen.findByText('Run without your 2 comments?');
    fireEvent.click(screen.getByRole('button', { name: 'Run anyway' }));
    await waitFor(() => expect(runPlan).toHaveBeenCalledTimes(1));
  });

  it('saves the half typed text before Run and asks first, as for any comment', async () => {
    const runPlan = stubRunPlan();
    render(<Scene hasComments={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Comment on part 1' }));
    const box = await screen.findByLabelText('Comment for the planner');
    fireEvent.change(box, { target: { value: 'Name the header that carries the key.' } });

    fireEvent.blur(box);
    fireEvent.click(screen.getByTestId('artifact-action-runPlan'));

    await screen.findByText('Run without your comment?');
    expect(runPlan).not.toHaveBeenCalled();
    screen.getByText('Name the header that carries the key.');
    expect(useAppStore.getState().artifactComments).toMatchObject({
      'mock-artifact-session-ledger': [{ status: 'draft' }],
    });
  });

  it('runs at once with no comment to lose, and Run takes the fill back', async () => {
    render(<Scene hasComments={false} />);
    const run = await screen.findByTestId('artifact-action-runPlan');
    expect(run.getAttribute('data-variant')).toBe('primary');
  });

  it('tells the story of a plan that ran: not sent, Copy, Send to the agent', async () => {
    render(<Scene hasRun />);

    const bar = await screen.findByTestId('plan-comment-bar');
    within(bar).getByText('2 comments not sent');
    within(bar).getByText('Implementer can still read them.');
    within(bar).getByRole('button', { name: 'Copy' });
    fireEvent.click(within(bar).getByRole('button', { name: 'Send to Implementer' }));
    await screen.findByText('Sent to Implementer.');
    expect(screen.getAllByText('Sent')).toHaveLength(2);
  });

  it('marks the comments sent and drops the bar after Send', async () => {
    render(<Scene />);
    fireEvent.click(await screen.findByRole('button', { name: 'Send to planner' }));
    await waitFor(() => expect(screen.queryByTestId('plan-comment-bar')).toBeNull());
    expect(screen.getAllByText('Sent')).toHaveLength(2);
  });
});
