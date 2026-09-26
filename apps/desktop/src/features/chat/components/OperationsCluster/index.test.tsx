// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';

const runId = (value: string): ProviderRunId => JSON.parse(JSON.stringify(value));
const iso = (value: string): IsoDateTime => JSON.parse(JSON.stringify(value));

const cardRenders = vi.hoisted(() => ({ count: 0 }));

vi.mock('../TranscriptCards', () => ({
  TranscriptCard: ({ item }: { item: TranscriptItem }) => {
    cardRenders.count += 1;
    return <div data-testid="card">{item.key}</div>;
  },
}));

import { OperationsCluster } from './index';

function tool(
  id: string,
  ended = true,
  isError = false,
  endedAt = '2026-06-08T10:00:01.000Z',
): TranscriptItem {
  return {
    kind: 'tool_call',
    key: `tool-${id}`,
    toolUseId: id,
    toolName: id === 'b' ? 'grep' : 'read',
    input: null,
    output: null,
    isError,
    ended,
    runId: runId('run-1'),
    startedAt: iso('2026-06-08T10:00:00.000Z'),
    endedAt: ended ? iso(endedAt) : null,
  };
}

function request(toolUseId: string): TranscriptItem {
  return {
    kind: 'permission_request',
    key: `perm-req-${toolUseId}`,
    toolUseId,
    toolName: 'bash',
    runId: runId('run-1'),
    input: null,
    at: iso('2026-06-08T10:00:00.000Z'),
  };
}

afterEach(cleanup);

describe('OperationsCluster', () => {
  it('renders collapsed with a count and hides children', () => {
    render(<OperationsCluster items={[tool('a'), tool('b')]} />);
    expect(screen.getByText('operations')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.queryByTestId('card')).toBeNull();
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false');
  });

  it('reveals child cards when expanded', () => {
    render(<OperationsCluster items={[tool('a'), tool('b')]} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getAllByTestId('card')).toHaveLength(2);
  });

  it('shows the running tool name in the header while collapsed', () => {
    render(<OperationsCluster items={[tool('a'), tool('b', false)]} />);
    expect(screen.getByText('grep')).toBeTruthy();
  });

  it('shows no running label when all tools have ended', () => {
    render(<OperationsCluster items={[tool('a'), tool('b')]} />);
    expect(screen.queryByText('grep')).toBeNull();
  });

  it('surfaces a success and failure breakdown when a collapsed child errored', () => {
    render(<OperationsCluster items={[tool('a'), tool('b', true, true)]} />);
    expect(screen.getByText('1 success')).toBeTruthy();
    expect(screen.getByText('1 failed')).toBeTruthy();
  });

  it('suppresses the failure badge while a tool is still running', () => {
    render(<OperationsCluster items={[tool('a', true, true), tool('b', false)]} />);
    expect(screen.queryByText(/failed/)).toBeNull();
    expect(screen.getByText('grep')).toBeTruthy();
  });

  it('shows grouped tool-name summary when all ended and no errors', () => {
    render(<OperationsCluster items={[tool('a'), tool('c'), tool('b')]} />);
    expect(screen.getByText('2 read · 1 grep')).toBeTruthy();
  });

  it('aria-label uses singular "item" for single item', () => {
    render(<OperationsCluster items={[tool('a')]} />);
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('Operations, 1 item');
  });

  it('aria-label uses plural "items" for multiple items', () => {
    render(<OperationsCluster items={[tool('a'), tool('b')]} />);
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('Operations, 2 items');
  });

  it('aria-label includes running tool info', () => {
    render(<OperationsCluster items={[tool('a'), tool('b', false)]} />);
    expect(screen.getByRole('button').getAttribute('aria-label')).toContain('running grep');
  });

  it('aria-label includes success/failure counts when errors present', () => {
    render(<OperationsCluster items={[tool('a'), tool('b', true, true)]} />);
    const label = screen.getByRole('button').getAttribute('aria-label')!;
    expect(label).toContain('1 succeeded');
    expect(label).toContain('1 failed');
  });

  it('renders count badge with correct number', () => {
    render(<OperationsCluster items={[tool('a')]} />);
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('carries state on the icon and drops the rail once the cluster is neutral', () => {
    const { container } = render(<OperationsCluster items={[tool('a'), tool('b')]} />);
    expect(screen.getByTestId('operations-state-icon').getAttribute('data-node-state')).toBe(
      'done',
    );
    const rail = screen.getByRole('button').parentElement!;
    expect(rail.className).not.toContain('border-l-2');
    expect(container.querySelectorAll('[class*="border-danger"]')).toHaveLength(0);
    expect(container.querySelectorAll('[class*="border-success"]')).toHaveLength(0);
  });

  it('carries a warning rail while a permission request waits on you', () => {
    render(<OperationsCluster items={[tool('a', false), request('a')]} />);
    expect(screen.getByTestId('operations-state-icon').getAttribute('data-node-state')).toBe(
      'approval',
    );
    const rail = screen.getByRole('button').parentElement!;
    expect(rail.className).toContain('border-l-2');
    expect(rail.className).toContain('border-warning');
    expect(screen.getByText('Waiting for your approval')).toBeTruthy();
  });

  it('keeps a user-opened cluster open once the run completes', () => {
    const { rerender } = render(<OperationsCluster items={[tool('a', false)]} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getAllByTestId('card')).toHaveLength(1);
    rerender(<OperationsCluster items={[tool('a')]} />);
    expect(screen.getAllByTestId('card')).toHaveLength(1);
  });

  it('runs a live elapsed timer that freezes on completion', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T10:00:00.000Z'));
    const { rerender } = render(<OperationsCluster items={[tool('b', false)]} />);
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByText('3s')).toBeTruthy();
    rerender(<OperationsCluster items={[tool('b', true, false, '2026-06-08T10:00:03.000Z')]} />);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByText('3s')).toBeTruthy();
    vi.useRealTimers();
  });

  it('stays collapsed by default while a tool runs', () => {
    render(<OperationsCluster items={[tool('a'), tool('b', false)]} />);
    expect(screen.queryByTestId('card')).toBeNull();
  });

  it('shows a running node while a tool runs', () => {
    render(<OperationsCluster items={[tool('a'), tool('b', false)]} />);
    expect(screen.getByTestId('operations-state-icon').getAttribute('data-node-state')).toBe(
      'running',
    );
  });

  it('shows a failed node when a child errored and nothing runs', () => {
    render(<OperationsCluster items={[tool('a'), tool('b', true, true)]} />);
    expect(screen.getByTestId('operations-state-icon').getAttribute('data-node-state')).toBe(
      'failed',
    );
  });

  it('exposes a leading chevron that rotates when expanded', () => {
    render(<OperationsCluster items={[tool('a')]} />);
    expect(screen.getByTestId('transcript-chevron').getAttribute('class')).not.toContain(
      'rotate-90',
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByTestId('transcript-chevron').getAttribute('class')).toContain('rotate-90');
  });

  it('collapses back when clicked twice', () => {
    render(<OperationsCluster items={[tool('a')]} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getAllByTestId('card')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByTestId('card')).toBeNull();
  });

  it('skips re-rendering when the parent rebuilds the same items', () => {
    const { rerender } = render(<OperationsCluster items={[tool('a'), tool('b', false)]} />);
    fireEvent.click(screen.getByRole('button'));
    const before = cardRenders.count;

    rerender(<OperationsCluster items={[tool('a'), tool('b', false)]} />);
    expect(cardRenders.count).toBe(before);

    rerender(<OperationsCluster items={[tool('a'), tool('b')]} />);
    expect(cardRenders.count).toBeGreaterThan(before);
    expect(screen.queryByText('grep')).toBeNull();
  });
});
