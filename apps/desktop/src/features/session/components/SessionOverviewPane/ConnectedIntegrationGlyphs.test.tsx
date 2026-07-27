// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { store, remote } = vi.hoisted(() => ({
  store: {
    sessionExternalTasks: {} as Record<string, ReadonlyArray<unknown>>,
    workspaceIntegrations: {} as Record<string, ReadonlyArray<{ provider: string }>>,
  },
  remote: { kind: null as 'github' | 'gitlab' | 'other' | null },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (s: typeof store) => T) => selector(store),
}));

vi.mock('../../../worktree/useRemoteHostKind', () => ({
  useRemoteHostKind: () => remote.kind,
}));

import { ConnectedIntegrationGlyphs } from './ConnectedIntegrationGlyphs';

const session = { id: 'sess-1', workspaceId: 'ws-1' } as unknown as Session;

beforeEach(() => {
  store.sessionExternalTasks = {};
  store.workspaceIntegrations = {};
  remote.kind = null;
});
afterEach(cleanup);

describe('ConnectedIntegrationGlyphs', () => {
  it('renders nothing when no integration is connected', () => {
    const { container } = render(
      <ConnectedIntegrationGlyphs session={session} onSelectLens={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders only connected providers and routes clicks to their lens', () => {
    store.workspaceIntegrations = { 'ws-1': [{ provider: 'linear' }] };
    remote.kind = 'github';
    const onSelectLens = vi.fn();
    render(<ConnectedIntegrationGlyphs session={session} onSelectLens={onSelectLens} />);

    expect(screen.queryByRole('button', { name: /open sentry/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /open github/i }));
    expect(onSelectLens).toHaveBeenCalledWith('pr');
    fireEvent.click(screen.getByRole('button', { name: /open linear/i }));
    expect(onSelectLens).toHaveBeenCalledWith('linear');
  });
});
