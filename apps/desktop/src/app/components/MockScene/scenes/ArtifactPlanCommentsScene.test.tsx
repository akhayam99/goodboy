// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  it('marks the comments sent and drops the bar after Send', async () => {
    render(<Scene />);
    fireEvent.click(await screen.findByRole('button', { name: 'Send to planner' }));
    await waitFor(() => expect(screen.queryByTestId('plan-comment-bar')).toBeNull());
    expect(screen.getAllByText('Sent')).toHaveLength(2);
  });
});
