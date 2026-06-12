// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { extractClustersMock } = vi.hoisted(() => ({
  extractClustersMock: vi.fn<(text: string) => unknown>(() => null),
}));

vi.mock('@goodboy/core', () => ({ extractClustersFromMarker: extractClustersMock }));
vi.mock('@goodboy/ui', () => ({
  Markdown: ({ text }: { text: string }) => <span data-testid="md">{text}</span>,
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

import { ClustersCard } from './index';

beforeEach(() => extractClustersMock.mockReset());
afterEach(cleanup);

describe('ClustersCard', () => {
  it('renders nothing when no clusters detected', () => {
    extractClustersMock.mockReturnValue(null);
    const { container } = render(<ClustersCard assistantText="x" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for empty clusters array', () => {
    extractClustersMock.mockReturnValue([]);
    const { container } = render(<ClustersCard assistantText="x" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders card with cluster count (singular)', () => {
    extractClustersMock.mockReturnValue([{ title: 'Auth refactor', instructions: 'move files' }]);
    render(<ClustersCard assistantText="x" />);
    expect(screen.getByTestId('clusters-card')).toBeTruthy();
    expect(screen.getByText('1 cluster')).toBeTruthy();
  });

  it('renders card with cluster count (plural)', () => {
    extractClustersMock.mockReturnValue([
      { title: 'A', instructions: 'x' },
      { title: 'B', instructions: 'y' },
      { title: 'C', instructions: 'z' },
    ]);
    render(<ClustersCard assistantText="x" />);
    expect(screen.getByText('3 clusters')).toBeTruthy();
  });

  it('renders numbered cluster titles', () => {
    extractClustersMock.mockReturnValue([
      { title: 'First', instructions: 'do first' },
      { title: 'Second', instructions: 'do second' },
    ]);
    render(<ClustersCard assistantText="x" />);
    expect(screen.getByText('1.')).toBeTruthy();
    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByText('2.')).toBeTruthy();
    expect(screen.getByText('Second')).toBeTruthy();
  });

  it('instructions hidden by default, shown on click', () => {
    extractClustersMock.mockReturnValue([{ title: 'Setup', instructions: 'run pnpm install' }]);
    render(<ClustersCard assistantText="x" />);
    expect(screen.queryByTestId('md')).toBeNull();
    fireEvent.click(screen.getByText('Setup'));
    expect(screen.getByTestId('md').textContent).toBe('run pnpm install');
  });

  it('toggles instructions off on second click', () => {
    extractClustersMock.mockReturnValue([{ title: 'Setup', instructions: 'run pnpm install' }]);
    render(<ClustersCard assistantText="x" />);
    fireEvent.click(screen.getByText('Setup'));
    expect(screen.getByTestId('md')).toBeTruthy();
    fireEvent.click(screen.getByText('Setup'));
    expect(screen.queryByTestId('md')).toBeNull();
  });

  it('each cluster row toggles independently', () => {
    extractClustersMock.mockReturnValue([
      { title: 'A', instructions: 'inst-a' },
      { title: 'B', instructions: 'inst-b' },
    ]);
    render(<ClustersCard assistantText="x" />);
    fireEvent.click(screen.getByText('A'));
    expect(screen.getByText('inst-a')).toBeTruthy();
    expect(screen.queryByText('inst-b')).toBeNull();
    fireEvent.click(screen.getByText('B'));
    expect(screen.getByText('inst-a')).toBeTruthy();
    expect(screen.getByText('inst-b')).toBeTruthy();
  });
});
