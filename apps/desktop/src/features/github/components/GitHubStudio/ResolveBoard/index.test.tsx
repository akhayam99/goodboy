// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrComment } from '@goodboy/types';

const h = vi.hoisted(() => ({
  providers: [{ id: 'anthropic', connection: 'connected' }] as Array<{
    id: string;
    connection: string;
  }>,
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (s: { providers: typeof h.providers }) => T) =>
    selector({ providers: h.providers }),
}));

import { ResolveBoard, __test } from './index';

function comment(over: Partial<PrComment> = {}): PrComment {
  return {
    id: 'c1',
    author: 'alice',
    authorAvatarUrl: null,
    body: 'use a helper',
    createdAt: '2026-05-15T10:00:00Z',
    url: 'https://github.com/o/r/pull/1#discussion_r1',
    source: 'review',
    path: 'src/a.ts',
    line: 10,
    resolved: false,
    threadId: 'PRRT_1',
    ...over,
  };
}

beforeEach(() => {
  h.providers = [{ id: 'anthropic', connection: 'connected' }];
});
afterEach(cleanup);

describe('ResolveBoard helpers', () => {
  it('clampEffort keeps valid levels and falls back to the top for unsupported ones', () => {
    expect(__test.clampEffort('claude-sonnet-4-5', 'high')).toBe('high');
    expect(__test.clampEffort('claude-sonnet-4-5', 'max')).toBe('high');
    expect(__test.clampEffort('gpt-5-codex', 'max')).toBe('max');
  });

  it('configFor seeds the resolver default model for anthropic', () => {
    expect(__test.configFor('anthropic').model).toBe(__test.DEFAULT_CONFIG.model);
  });
});

describe('ResolveBoard', () => {
  it('counts selected comments and fans out only the selected ones', () => {
    const onSpawnBatch = vi.fn();
    render(
      <ResolveBoard
        comments={[comment({ id: 'c1' }), comment({ id: 'c2', threadId: 'PRRT_2' })]}
        onSpawnOne={vi.fn()}
        onSpawnBatch={onSpawnBatch}
        onOpenThread={vi.fn()}
      />,
    );
    expect(screen.getByText(/Spawn resolver for 2 comments/i)).toBeDefined();

    const checkboxes = screen.getAllByRole('checkbox');
    act(() => {
      fireEvent.click(checkboxes[1]!);
    });
    expect(screen.getByText(/Spawn resolver for 1 comment/i)).toBeDefined();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Spawn resolver for 1 comment/i }));
    });
    expect(onSpawnBatch).toHaveBeenCalledTimes(1);
    const batchArg = onSpawnBatch.mock.calls[0]?.[0] as ReadonlyArray<PrComment>;
    expect(batchArg.map((c) => c.id)).toEqual(['c2']);
  });

  it('spawns a single comment via its Resolve button', () => {
    const onSpawnOne = vi.fn();
    render(
      <ResolveBoard
        comments={[comment({ id: 'c1' })]}
        onSpawnOne={onSpawnOne}
        onSpawnBatch={vi.fn()}
        onOpenThread={vi.fn()}
      />,
    );
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^Resolve$/i }));
    });
    expect(onSpawnOne).toHaveBeenCalledTimes(1);
    expect(onSpawnOne.mock.calls[0]?.[0]?.id).toBe('c1');
  });

  it('renders an empty state when there are no open comments', () => {
    render(
      <ResolveBoard
        comments={[]}
        onSpawnOne={vi.fn()}
        onSpawnBatch={vi.fn()}
        onOpenThread={vi.fn()}
      />,
    );
    expect(screen.getByText(/Nothing to resolve/i)).toBeDefined();
  });
});
