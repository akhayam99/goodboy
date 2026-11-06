// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useAppStore } from '../../../../store';
import type { RunPlanResult } from '../../../../store/slices/plans/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import { ArtifactPlanCommentsScene } from './ArtifactPlanCommentsScene';

const Scene = () => (
  <ToastProvider>
    <ArtifactPlanCommentsScene />
  </ToastProvider>
);

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
    expect(within(frames[1] as HTMLElement).getByText(/Split the charge path/)).toBeDefined();
    expect(within(frames[0] as HTMLElement).queryByTestId('plan-comment')).toBeNull();
    expect(screen.getByText('idempotency keys').tagName).toBe('Q');
    const bar = screen.getByTestId('plan-comment-bar');
    expect(within(bar).getByText('2 comments')).toBeDefined();
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
    const runPlan = vi.fn(async (): Promise<RunPlanResult> => ({
      kind: 'refused',
      reason: null,
      workflowRunId: null,
    }));
    useAppStore.setState({ runPlan });
    render(<Scene />);
    await screen.findAllByTestId('plan-comment');

    fireEvent.click(screen.getByTestId('artifact-action-runPlan'));

    expect(runPlan).not.toHaveBeenCalled();
    expect(await screen.findByText('Run without your 2 comments?')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Run anyway' }));
    await waitFor(() => expect(runPlan).toHaveBeenCalledTimes(1));
  });

  it('runs at once with no comment to lose, and Run takes the fill back', async () => {
    render(
      <ToastProvider>
        <ArtifactPlanCommentsScene hasComments={false} />
      </ToastProvider>,
    );
    const run = await screen.findByTestId('artifact-action-runPlan');
    expect(run.getAttribute('data-variant')).toBe('primary');
  });

  it('marks the comments sent and drops the bar after Send', async () => {
    render(<Scene />);
    fireEvent.click(await screen.findByRole('button', { name: 'Send to planner' }));
    await waitFor(() => expect(screen.queryByTestId('plan-comment-bar')).toBeNull());
    expect(screen.getAllByText('Sent')).toHaveLength(2);
  });
});
