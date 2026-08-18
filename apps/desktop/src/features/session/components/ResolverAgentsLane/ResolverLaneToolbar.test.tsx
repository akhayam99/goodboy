// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  hasPending: false,
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (state: { sessionPendingResolutions: Record<string, unknown[]> }) => T,
  ) =>
    selector({
      sessionPendingResolutions: h.hasPending ? { 'sess-1': [{ threadId: 'PRRT_1' }] } : {},
    }),
  EMPTY_ARRAY: [] as never[],
}));

vi.mock('../../../context/components/ContextPanel/strips/PendingResolutionsStrip', () => ({
  PendingResolutionsStrip: () => <div data-testid="pending-strip" />,
}));

import { ResolverLaneToolbar } from './ResolverLaneToolbar';

const SID = 'sess-1' as SessionId;

const renderToolbar = ({
  queuedCount,
  isStalled,
}: {
  readonly queuedCount: number;
  readonly isStalled: boolean;
}) =>
  render(
    <ResolverLaneToolbar
      sessionId={SID}
      queuedCount={queuedCount}
      isStalled={isStalled}
      onForceNext={() => undefined}
    />,
  );

afterEach(() => {
  cleanup();
  h.hasPending = false;
});

describe('ResolverLaneToolbar', () => {
  it('does not show Run next when only one resolver is queued', () => {
    renderToolbar({ queuedCount: 1, isStalled: true });
    expect(screen.queryByRole('button', { name: /Run next/ })).toBeNull();
  });

  it('shows Run next only when more than one resolver waits behind the stalled head', () => {
    renderToolbar({ queuedCount: 3, isStalled: true });
    expect(screen.getByRole('button', { name: 'Run next (3)' })).toBeTruthy();
  });

  it('does not show Run next when the queue is not stalled', () => {
    renderToolbar({ queuedCount: 3, isStalled: false });
    expect(screen.queryByRole('button', { name: /Run next/ })).toBeNull();
  });

  it('renders nothing when there is neither pending resolution nor stalled queue', () => {
    const { container } = renderToolbar({ queuedCount: 0, isStalled: false });
    expect(container.textContent).toBe('');
  });

  it('shows the pending strip when there are pending resolutions', () => {
    h.hasPending = true;
    renderToolbar({ queuedCount: 0, isStalled: false });
    expect(screen.getByTestId('pending-strip')).toBeTruthy();
  });
});
