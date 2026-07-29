import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  TurnState,
} from '@goodboy/types';
import type { ResolverStatus } from '../../resolver-linkage';

const h = vi.hoisted(() => {
  const runtime: { turnState: TurnState | undefined } = { turnState: undefined };
  return {
    resolveGithubThread: vi.fn(async () => true),
    runtime,
  };
});

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (state: {
      agentTurnState: Record<string, TurnState | undefined>;
      resolveGithubThread: typeof h.resolveGithubThread;
    }) => T,
  ) =>
    selector({
      agentTurnState: { 'agent-1': h.runtime.turnState },
      resolveGithubThread: h.resolveGithubThread,
    }),
}));

import { ForceResolveAction } from './index';

const SESSION_ID = 'session-1' as SessionId;
const AGENT = {
  id: 'agent-1' as AgentId,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'resolver',
  status: 'completed',
  sourceThreadId: 'thread-1',
} satisfies Agent;
const AGENT_WITHOUT_THREAD = {
  id: 'agent-1' as AgentId,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'resolver',
  status: 'completed',
} satisfies Agent;
const OTHER_AGENT = {
  id: 'agent-2' as AgentId,
  sessionId: SESSION_ID,
  ordinal: 1,
  name: 'resolver',
  status: 'completed',
  sourceThreadId: 'thread-2',
} satisfies Agent;

describe('ForceResolveAction', () => {
  beforeEach(() => {
    h.resolveGithubThread.mockReset();
    h.resolveGithubThread.mockResolvedValue(true);
    h.runtime.turnState = undefined;
  });

  afterEach(cleanup);

  it('arms on the first click and resolves without a note on confirmation', async () => {
    render(<ForceResolveAction agent={AGENT} sessionId={SESSION_ID} status="awaiting" />);

    fireEvent.click(screen.getByRole('button', { name: 'Mark resolved' }));
    expect(h.resolveGithubThread).not.toHaveBeenCalled();

    const panel = screen.getByRole('group', { name: 'Mark thread resolved?' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Mark resolved' }));
    await waitFor(() =>
      expect(h.resolveGithubThread).toHaveBeenCalledWith(SESSION_ID, 'thread-1', {}),
    );
  });

  it('passes the optional note as the resolution reason', async () => {
    render(<ForceResolveAction agent={AGENT} sessionId={SESSION_ID} status="failed" />);

    fireEvent.click(screen.getByRole('button', { name: 'Mark resolved' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Resolution note' }), {
      target: { value: 'Handled outside this branch' },
    });
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Mark thread resolved?' })).getByRole('button', {
        name: 'Mark resolved',
      }),
    );

    await waitFor(() =>
      expect(h.resolveGithubThread).toHaveBeenCalledWith(SESSION_ID, 'thread-1', {
        reason: 'Handled outside this branch',
      }),
    );
  });

  it('is absent without a source thread', () => {
    render(
      <ForceResolveAction agent={AGENT_WITHOUT_THREAD} sessionId={SESSION_ID} status="done" />,
    );

    expect(screen.queryByRole('button', { name: 'Mark resolved' })).toBeNull();
  });

  it.each(['committed', 'wontfix'] satisfies ReadonlyArray<ResolverStatus>)(
    'is absent for %s resolvers',
    (status) => {
      render(<ForceResolveAction agent={AGENT} sessionId={SESSION_ID} status={status} />);

      expect(screen.queryByRole('button', { name: 'Mark resolved' })).toBeNull();
    },
  );

  it.each(['starting', 'running'] satisfies ReadonlyArray<TurnState['kind']>)(
    'is absent while the live turn is %s',
    (kind) => {
      h.runtime.turnState =
        kind === 'starting'
          ? { kind, startedAt: '2026-07-22T00:00:00.000Z' as IsoDateTime }
          : {
              kind,
              runId: 'run-1' as ProviderRunId,
              startedAt: '2026-07-22T00:00:00.000Z' as IsoDateTime,
            };
      render(<ForceResolveAction agent={AGENT} sessionId={SESSION_ID} status="done" />);

      expect(screen.queryByRole('button', { name: 'Mark resolved' })).toBeNull();
    },
  );

  it('stays available for a resolver the user force closed', () => {
    render(<ForceResolveAction agent={AGENT} sessionId={SESSION_ID} status="stopped" />);

    expect(screen.getByRole('button', { name: 'Mark resolved' })).toBeDefined();
  });

  it('resets the armed note when the selected resolver changes', () => {
    const view = render(
      <ForceResolveAction agent={AGENT} sessionId={SESSION_ID} status="awaiting" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mark resolved' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Resolution note' }), {
      target: { value: 'half typed' },
    });

    view.rerender(
      <ForceResolveAction agent={OTHER_AGENT} sessionId={SESSION_ID} status="awaiting" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mark resolved' }));

    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Resolution note' }).value).toBe(
      '',
    );
  });

  it('disappears when the refreshed resolver status becomes resolved', async () => {
    const view = render(<ForceResolveAction agent={AGENT} sessionId={SESSION_ID} status="done" />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark resolved' }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Mark thread resolved?' })).getByRole('button', {
        name: 'Mark resolved',
      }),
    );
    await waitFor(() => expect(h.resolveGithubThread).toHaveBeenCalledOnce());

    view.rerender(<ForceResolveAction agent={AGENT} sessionId={SESSION_ID} status="resolved" />);

    expect(screen.queryByRole('button', { name: 'Mark resolved' })).toBeNull();
  });
});
