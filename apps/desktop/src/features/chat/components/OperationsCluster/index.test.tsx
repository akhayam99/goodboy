// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('surfaces a failure count when a collapsed child errored', () => {
    render(<OperationsCluster items={[tool('a'), tool('b', true, true)]} />);
    expect(screen.getByText('1 failed')).toBeTruthy();
  });

  it('suppresses the failure badge while a tool is still running', () => {
    render(<OperationsCluster items={[tool('a', true, true), tool('b', false)]} />);
    expect(screen.queryByText(/failed/)).toBeNull();
    expect(screen.getByText('grep')).toBeTruthy();
  });
});
