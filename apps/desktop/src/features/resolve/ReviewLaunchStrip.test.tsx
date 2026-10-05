// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { startBatch as StartBatch } from './startBatch';
import { ReviewLaunchStrip } from './ReviewLaunchStrip';
import { REVIEW_LAUNCH_LABEL } from './reviewLaunchCopy';

const { startBatch } = vi.hoisted(() => ({
  startBatch: vi.fn<typeof StartBatch>(),
}));

vi.mock('./startBatch', () => ({ startBatch }));

const SESSION_ID = 'session-launch' as SessionId;

beforeEach(() => {
  startBatch.mockReset();
  startBatch.mockResolvedValue({ batchId: 'batch-1', agentIds: [] });
  useAppStore.setState({ resolveQueueView: {} });
});

afterEach(() => {
  cleanup();
});

const renderStrip = (onStarted = vi.fn()) =>
  render(
    <ReviewLaunchStrip
      sessionId={SESSION_ID}
      threadIds={['PRRT_1']}
      onClose={vi.fn()}
      onStarted={onStarted}
    />,
  );

describe('ReviewLaunchStrip', () => {
  it('names the resolver default and does not turn it into a pick after a launch', async () => {
    const onStarted = vi.fn();
    renderStrip(onStarted);

    screen.getByText(REVIEW_LAUNCH_LABEL.roleDefault);
    fireEvent.click(screen.getByRole('button', { name: /^Start/ }));

    await waitFor(() => expect(onStarted).toHaveBeenCalledTimes(1));
    expect(useAppStore.getState().resolveQueueView[SESSION_ID]?.lastRouting ?? null).toBeNull();
    screen.getByText(REVIEW_LAUNCH_LABEL.roleDefault);
  });

  it('says the pick is kept for the session once one is made', async () => {
    renderStrip();

    act(() => {
      useAppStore.getState().setResolveQueueView({
        sessionId: SESSION_ID,
        patch: { lastRouting: { provider: 'anthropic', model: 'claude-opus-5', effort: 'high' } },
      });
    });

    await screen.findByText(REVIEW_LAUNCH_LABEL.remembered);
    expect(screen.queryByText(REVIEW_LAUNCH_LABEL.roleDefault)).toBeNull();
  });
});
