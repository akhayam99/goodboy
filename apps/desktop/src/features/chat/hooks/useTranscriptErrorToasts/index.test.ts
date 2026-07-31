// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type { AgentId, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';

const { state } = vi.hoisted(() => ({
  state: { emitNotification: vi.fn(async () => undefined) },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T>(selector: (s: typeof state) => T) => selector(state),
}));

import { useTranscriptErrorToasts } from './index';

const errorItem = (key: string): TranscriptItem => ({ kind: 'error', key, message: 'boom' });

afterEach(() => {
  cleanup();
  state.emitNotification.mockClear();
});

describe('useTranscriptErrorToasts', () => {
  it('never replays errors already in the loaded transcript', () => {
    renderHook(() =>
      useTranscriptErrorToasts({
        items: [errorItem('e1')],
        sessionId: 's1' as SessionId,
        agentId: 'a1' as AgentId,
      }),
    );
    expect(state.emitNotification).not.toHaveBeenCalled();
  });

  it('raises a notification for an error that arrives live', () => {
    const { rerender } = renderHook(
      ({ items }: { items: ReadonlyArray<TranscriptItem> }) =>
        useTranscriptErrorToasts({
          items,
          sessionId: 's1' as SessionId,
          agentId: 'a1' as AgentId,
        }),
      { initialProps: { items: [] as ReadonlyArray<TranscriptItem> } },
    );
    rerender({ items: [errorItem('e1')] });
    expect(state.emitNotification).toHaveBeenCalledWith(
      'error',
      'error',
      'agent run failed',
      'boom',
      {
        sessionId: 's1',
      },
    );
    rerender({ items: [errorItem('e1')] });
    expect(state.emitNotification).toHaveBeenCalledTimes(1);
  });
});
