import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PendingResolution, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { PendingResolutionsStrip } from './PendingResolutionsStrip';

const SESSION_ID = 'session-1' as SessionId;

const loadPendingResolutions = vi.fn(async () => undefined);
const pushAllResolutions = vi.fn(async () => undefined);

const seed = (count: number) => {
  const pending = Array.from(
    { length: count },
    (_, index) => ({ id: `pr-${index}` }) as unknown as PendingResolution,
  );
  useAppStore.setState({
    sessionPendingResolutions: { [SESSION_ID]: pending },
    loadPendingResolutions,
    pushAllResolutions,
  });
};

beforeEach(() => {
  loadPendingResolutions.mockClear();
  pushAllResolutions.mockClear();
});

afterEach(cleanup);

describe('PendingResolutionsStrip', () => {
  it('renders nothing when nothing is queued', () => {
    seed(0);
    const { container } = render(<PendingResolutionsStrip sessionId={SESSION_ID} />);
    expect(container.firstChild).toBeNull();
  });

  it('loads the queue for the session on mount', () => {
    seed(0);
    render(<PendingResolutionsStrip sessionId={SESSION_ID} />);
    expect(loadPendingResolutions).toHaveBeenCalledWith(SESSION_ID);
  });

  it('pluralizes the queued comment count', () => {
    seed(1);
    render(<PendingResolutionsStrip sessionId={SESSION_ID} />);
    expect(screen.getByText('Push & resolve 1 comment')).toBeTruthy();
    cleanup();
    seed(3);
    render(<PendingResolutionsStrip sessionId={SESSION_ID} />);
    expect(screen.getByText('Push & resolve 3 comments')).toBeTruthy();
  });

  it('pushes every queued resolution once per click', async () => {
    seed(2);
    render(<PendingResolutionsStrip sessionId={SESSION_ID} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    expect(pushAllResolutions).toHaveBeenCalledWith(SESSION_ID);
    expect(pushAllResolutions).toHaveBeenCalledTimes(1);
  });
});
