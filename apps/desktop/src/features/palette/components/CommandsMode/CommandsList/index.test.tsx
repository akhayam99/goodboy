// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { CommandsList } from '.';

type ListProps = Parameters<typeof CommandsList>[0];

const noop = () => undefined;

const renderList = ({ isLoaded }: { readonly isLoaded: boolean }) => {
  const props: ListProps = {
    listRef: { current: null },
    listboxId: 'commands',
    maxHeight: 320,
    sections: [],
    selectedKey: null,
    query: '',
    isLoaded,
    gateKey: 'session:harborline',
    optionId: ({ id }) => id,
    onSelect: noop,
    onRun: noop,
  };
  return render(<CommandsList {...props} />);
};

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('CommandsList load state', () => {
  it('draws nothing before 120 ms and then a skeleton, never the empty state, while loading', () => {
    renderList({ isLoaded: false });

    expect(screen.queryByText('Nothing to do here yet')).toBeNull();
    expect(screen.queryByRole('status', { name: 'Loading commands' })).toBeNull();

    advance(130);

    expect(screen.getAllByRole('status', { name: 'Loading commands' })).toHaveLength(3);
    expect(screen.queryByText('Nothing to do here yet')).toBeNull();
  });

  it('draws the empty state at once when it is loaded and nothing matches', () => {
    renderList({ isLoaded: true });

    screen.getByText('Nothing to do here yet');
    expect(screen.queryByRole('status', { name: 'Loading commands' })).toBeNull();
  });
});
