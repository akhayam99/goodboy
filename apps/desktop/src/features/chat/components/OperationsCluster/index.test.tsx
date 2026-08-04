// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { TranscriptItem } from '../../utils/transcript-items';

vi.mock('../TranscriptCards', () => ({
  TranscriptCard: ({ item }: { item: TranscriptItem }) => <div data-testid="card">{item.key}</div>,
}));

import { OperationsCluster } from './index';

function tool(id: string, ended = true, isError = false): TranscriptItem {
  return {
    kind: 'tool_call',
    key: `tool-${id}`,
    toolUseId: id,
    toolName: id === 'b' ? 'grep' : 'read',
    input: null,
    output: null,
    isError,
    ended,
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

  it('carries state on the icon and never on the rail', () => {
    const { container } = render(<OperationsCluster items={[tool('a'), tool('b')]} />);
    expect(screen.getByTestId('operations-state-icon').getAttribute('class')).toContain(
      'text-success',
    );
    const rail = screen.getByRole('button').parentElement!;
    expect(rail.className).toContain('border-l-2');
    expect(rail.className).toContain('border-primary/20');
    expect(screen.getByRole('button').className).not.toContain('border-l-2');
    expect(container.querySelectorAll('[class*="border-danger"]')).toHaveLength(0);
    expect(container.querySelectorAll('[class*="border-success"]')).toHaveLength(0);
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
    const { rerender } = render(<OperationsCluster items={[tool('b', false)]} />);
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByText('3s')).toBeTruthy();
    rerender(<OperationsCluster items={[tool('b')]} />);
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

  it('pulses the state icon while a tool runs', () => {
    render(<OperationsCluster items={[tool('a'), tool('b', false)]} />);
    const icon = screen.getByTestId('operations-state-icon');
    expect(icon.getAttribute('class')).toContain('text-warning');
    expect(icon.getAttribute('class')).toContain('animate-pulse');
  });

  it('turns the state icon red when a child errored', () => {
    render(<OperationsCluster items={[tool('a'), tool('b', true, true)]} />);
    expect(screen.getByTestId('operations-state-icon').getAttribute('class')).toContain(
      'text-danger',
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
});
