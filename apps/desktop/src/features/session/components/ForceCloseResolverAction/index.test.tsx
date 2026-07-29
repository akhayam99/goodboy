import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import type { ResolverStatus } from '../../resolver-linkage';

const h = vi.hoisted(() => ({ forceCloseResolver: vi.fn(async () => undefined) }));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: { forceCloseResolver: typeof h.forceCloseResolver }) => T) =>
    selector({ forceCloseResolver: h.forceCloseResolver }),
}));

import { ForceCloseResolverAction } from './index';

const SESSION_ID = 'session-1' as SessionId;
const RUNNING = {
  id: 'agent-1' as AgentId,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'resolve: reviewer on a.ts:1',
  status: 'running',
  sourceThreadId: 'PRRT_1',
} satisfies Agent;

describe('ForceCloseResolverAction', () => {
  beforeEach(() => h.forceCloseResolver.mockReset());
  afterEach(cleanup);

  it('arms on the first click and force closes on confirmation', async () => {
    render(<ForceCloseResolverAction agent={RUNNING} sessionId={SESSION_ID} status="running" />);

    fireEvent.click(screen.getByRole('button', { name: 'Force close' }));
    expect(h.forceCloseResolver).not.toHaveBeenCalled();

    const panel = screen.getByRole('group', { name: 'Force close this resolver?' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Force close' }));
    await waitFor(() => expect(h.forceCloseResolver).toHaveBeenCalledWith(SESSION_ID, RUNNING.id));
  });

  it('stays available for a row stuck at running without a live status', () => {
    render(<ForceCloseResolverAction agent={RUNNING} sessionId={SESSION_ID} status="done" />);

    expect(screen.getByRole('button', { name: 'Force close' })).toBeDefined();
  });

  it.each(['resolved', 'committed', 'awaiting'] satisfies ReadonlyArray<ResolverStatus>)(
    'is absent for a %s resolver that is not running',
    (status) => {
      render(
        <ForceCloseResolverAction
          agent={{ ...RUNNING, status: 'completed' }}
          sessionId={SESSION_ID}
          status={status}
        />,
      );

      expect(screen.queryByRole('button', { name: 'Force close' })).toBeNull();
    },
  );
});
