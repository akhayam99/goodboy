// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  state: {
    sessions: [] as ReadonlyArray<unknown>,
    providers: [
      { id: 'anthropic', connection: 'connected' },
      { id: 'codex', connection: 'connected' },
    ],
    cliRequirements: [] as ReadonlyArray<unknown>,
    authResults: {},
    spawnAgent: vi.fn(
      async (_sessionId: string, _args: { readonly provider?: string; readonly model: string }) =>
        'agent-1',
    ),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (s: typeof h.state) => T) => selector(h.state),
}));
vi.mock('../../../../shared/hooks/useSessionRoleModels', () => ({
  useSessionRoleModels: () => ({
    scout: { providerId: 'codex', model: 'gpt-5.6-luna', effort: 'medium' },
  }),
}));
vi.mock('../../../../shared/hooks/useAgentStartedToast', () => ({
  useAgentStartedToast: () => vi.fn(),
}));

import { ExploreSpawnPopover } from './ExploreSpawnPopover';

const SESSION_ID = 'session-1' as SessionId;

afterEach(cleanup);

describe('ExploreSpawnPopover', () => {
  it('seeds the agent routing from the scout role, not the generalist', async () => {
    render(
      <ExploreSpawnPopover
        sessionId={SESSION_ID}
        entry={{ name: 'retry.ts', relPath: 'src/retry.ts', kind: 'file' } as never}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ask an agent to work on retry.ts' }));
    fireEvent.change(
      screen.getByRole('textbox', { name: 'What should the agent do with this file?' }),
      {
        target: { value: 'Explain the backoff' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start agent' }));

    await vi.waitFor(() => expect(h.state.spawnAgent).toHaveBeenCalledTimes(1));
    const args = h.state.spawnAgent.mock.calls[0]?.[1];
    expect(args?.provider).toBe('codex');
    expect(args?.model).toBe('gpt-5.6-luna');
  });
});
