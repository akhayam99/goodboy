// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { MountId, SessionId } from '@goodboy/types';

const SESSION_ID = 'session-1' as SessionId;
const MOUNT_ID = 'mount-payments' as MountId;

const h = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  openReviewTarget: vi.fn(async () => ({ kind: 'opened' as const })),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Record<string, unknown>) => T) => selector(h.state),
}));

import { REVIEW_MARKER_LABEL, useDiffReviewThreads } from './index';

type CommentParams = {
  readonly threadId: string;
  readonly resolved?: boolean;
  readonly outdated?: boolean;
};

const comment = ({ threadId, resolved = false, outdated = false }: CommentParams) => ({
  id: `c-${threadId}`,
  author: 'kenji-w',
  authorAvatarUrl: null,
  body: 'Cap the retries at three.',
  createdAt: '2026-09-27T10:00:00.000Z',
  url: '',
  source: 'review',
  path: 'src/webhooks.ts',
  line: 42,
  resolved,
  outdated,
  threadId,
});

const seed = (comments: ReadonlyArray<ReturnType<typeof comment>>): void => {
  h.state = {
    mountGithub: { [MOUNT_ID]: { pr: { number: 318 }, detail: { comments } } },
    sessionGithub: {},
    sessionResolveThreads: {},
    sessionActiveMount: {},
    openReviewTarget: h.openReviewTarget,
  };
};

afterEach(() => {
  cleanup();
  h.openReviewTarget.mockClear();
});

describe('useDiffReviewThreads', () => {
  it('marks each open review comment on its line, read only', () => {
    seed([
      comment({ threadId: 'PRRT_1' }),
      comment({ threadId: 'PRRT_2', resolved: true }),
      comment({ threadId: 'PRRT_3', outdated: true }),
    ]);

    const { result } = renderHook(() =>
      useDiffReviewThreads({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    );

    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toMatchObject({
      id: 'review:PRRT_1',
      filePath: 'src/webhooks.ts',
      anchor: { side: 'new', lineNumber: 42 },
      statusLabel: REVIEW_MARKER_LABEL,
      canEdit: false,
      canClose: false,
      canReopen: false,
      canDelete: false,
    });
  });

  it('opens Review on that comment from the marker', () => {
    seed([comment({ threadId: 'PRRT_1' })]);
    const { result } = renderHook(() =>
      useDiffReviewThreads({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    );

    render(<>{result.current[0]?.footer}</>);
    fireEvent.click(screen.getByRole('button', { name: /Open in Comments/ }));

    expect(h.openReviewTarget).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      destination: { kind: 'thread', mountId: MOUNT_ID, prNumber: 318, threadId: 'PRRT_1' },
    });
  });

  it('marks nothing without a mount', () => {
    seed([comment({ threadId: 'PRRT_1' })]);
    const { result } = renderHook(() =>
      useDiffReviewThreads({ sessionId: SESSION_ID, mountId: null }),
    );

    expect(result.current).toEqual([]);
  });
});
