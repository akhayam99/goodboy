// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    sessionExternalTasks: {} as Record<string, ReadonlyArray<{ provider: string }>>,
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (s: typeof store) => T) => selector(store),
}));

import { ConnectedIntegrationGlyphs } from './ConnectedIntegrationGlyphs';

const session = { id: 'sess-1', workspaceId: 'ws-1' } as unknown as Session;

beforeEach(() => {
  store.sessionExternalTasks = {};
});
afterEach(cleanup);

describe('ConnectedIntegrationGlyphs', () => {
  it('renders nothing when no provider has a linked task', () => {
    const { container } = render(
      <ConnectedIntegrationGlyphs session={session} onSelectLens={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for a connected-but-unlinked provider', () => {
    const { container } = render(
      <ConnectedIntegrationGlyphs session={session} onSelectLens={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: /open github/i })).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it('renders only providers with a linked task and routes clicks to their lens', () => {
    store.sessionExternalTasks = {
      'sess-1': [{ provider: 'linear' }, { provider: 'github' }],
    };
    const onSelectLens = vi.fn();
    render(<ConnectedIntegrationGlyphs session={session} onSelectLens={onSelectLens} />);

    expect(screen.queryByRole('button', { name: /open sentry/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /open gitlab/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /open github/i }));
    expect(onSelectLens).toHaveBeenCalledWith('pr');
    fireEvent.click(screen.getByRole('button', { name: /open linear/i }));
    expect(onSelectLens).toHaveBeenCalledWith('linear');
  });
});
