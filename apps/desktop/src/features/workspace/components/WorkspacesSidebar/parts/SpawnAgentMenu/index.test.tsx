// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProviderId, SessionId } from '@goodboy/types';

type Store = {
  readonly spawnAgent: ReturnType<typeof vi.fn>;
  readonly providers: ReadonlyArray<{ readonly id: ProviderId; readonly connection: string }>;
};

const h = vi.hoisted(() => ({
  spawnAgent: vi.fn(async () => 'a1'),
  providers: [{ id: 'anthropic' as ProviderId, connection: 'connected' }],
}));

vi.mock('../../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Store) => T) =>
    selector({ spawnAgent: h.spawnAgent, providers: h.providers }),
}));

import { SpawnAgentMenu } from './index';

const SID = 'sess-1' as SessionId;

const openMenu = () => {
  render(
    <SpawnAgentMenu
      sessionId={SID}
      onSpawned={vi.fn()}
      trigger={(props) => (
        <button type="button" {...props}>
          new agent
        </button>
      )}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'new agent' }));
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SpawnAgentMenu', () => {
  it('offers a routing picker next to the role list', () => {
    openMenu();
    const picker = screen.getByRole('button', { name: 'new agent routing' });
    expect(picker.textContent).toContain('Claude');
    expect(picker.textContent).toContain('recommended');
  });

  it('spawns with the role default until the routing is pinned', () => {
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Plan/ }));
    expect(h.spawnAgent).toHaveBeenCalledWith(SID, { kindOverride: 'planner' });
  });

  it('passes a pinned model, provider and effort to the spawn', () => {
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'new agent routing' }));
    fireEvent.click(screen.getByTitle('claude-opus-5'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Docs/ }));
    expect(h.spawnAgent).toHaveBeenCalledWith(SID, {
      kindOverride: 'docs',
      provider: 'anthropic',
      model: 'claude-opus-5',
      effort: 'low',
    });
  });
});
