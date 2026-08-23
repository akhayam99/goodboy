// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    spawnAgent: vi.fn(async () => 'agent-1'),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { OverviewStartAgent } from './OverviewStartAgent';

const SESSION_ID = 'sess-1' as SessionId;

beforeEach(() => {
  state.spawnAgent.mockClear();
});
afterEach(cleanup);

describe('OverviewStartAgent', () => {
  it('spawns the root agent into the chat zone, never a stripped composer', async () => {
    const revealListener = vi.fn();
    window.addEventListener('goodboy:reveal-chat', revealListener);
    render(<OverviewStartAgent sessionId={SESSION_ID} />);

    expect(screen.getByText('Agents')).toBeDefined();
    expect(screen.queryByRole('textbox')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /start an agent/i }));

    await waitFor(() =>
      expect(state.spawnAgent).toHaveBeenCalledWith(SESSION_ID, { focus: 'agent' }),
    );
    await waitFor(() => expect(revealListener).toHaveBeenCalledOnce());
    window.removeEventListener('goodboy:reveal-chat', revealListener);
  });
});
