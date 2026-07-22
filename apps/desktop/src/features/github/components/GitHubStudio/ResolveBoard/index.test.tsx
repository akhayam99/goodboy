// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrComment } from '@goodboy/types';
import type { ResolveModelChoice } from '../../../../chat/spawn-from-comment';
import type { CommentThread } from '../../../comment-threads';

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

import { ResolveBoard } from './index';

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

function thread(
  over: Partial<PrComment> = {},
  replies: ReadonlyArray<PrComment> = [],
): CommentThread {
  return { head: comment(over), replies };
}

beforeEach(() => {
  h.providers = [{ id: 'anthropic', connection: 'connected' }];
});
afterEach(cleanup);

describe('ResolveBoard', () => {
  it('counts selected comments and fans out only the selected ones', () => {
    const onSpawnBatch = vi.fn();
    render(
      <ResolveBoard
        threads={[thread({ id: 'c1' }), thread({ id: 'c2', threadId: 'PRRT_2' })]}
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
    const batchArg = onSpawnBatch.mock.calls[0]?.[0] as ReadonlyArray<CommentThread>;
    expect(batchArg.map((t) => t.head.id)).toEqual(['c2']);
  });

  it('spawns a single comment via its Resolve button', () => {
    const onSpawnOne = vi.fn<(thread: CommentThread, choice: ResolveModelChoice) => void>();
    render(
      <ResolveBoard
        threads={[thread({ id: 'c1' })]}
        onSpawnOne={onSpawnOne}
        onSpawnBatch={vi.fn()}
        onOpenThread={vi.fn()}
      />,
    );
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^Resolve$/i }));
    });
    expect(onSpawnOne).toHaveBeenCalledTimes(1);
    expect(onSpawnOne.mock.calls[0]?.[0]?.head?.id).toBe('c1');
    expect(onSpawnOne.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ mode: 'fix', hint: '' }),
    );
  });

  it('applies mode and hint to a single resolver', () => {
    const onSpawnOne = vi.fn<(thread: CommentThread, choice: ResolveModelChoice) => void>();
    render(
      <ResolveBoard
        threads={[thread({ id: 'c1' })]}
        onSpawnOne={onSpawnOne}
        onSpawnBatch={vi.fn()}
        onOpenThread={vi.fn()}
      />,
    );
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Resolve with/i }));
    });
    act(() => {
      fireEvent.change(screen.getByRole('combobox', { name: /Resolver mode/i }), {
        target: { value: 'analyze' },
      });
      fireEvent.change(screen.getByRole('textbox', { name: /Resolver hint/i }), {
        target: { value: 'Avoid schema changes.' },
      });
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^Resolve$/i }));
    });
    expect(onSpawnOne.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ mode: 'analyze', hint: 'Avoid schema changes.' }),
    );
  });

  it('shares mode and hint across every resolver in a batch', () => {
    const onSpawnBatch =
      vi.fn<
        (
          threads: ReadonlyArray<CommentThread>,
          choiceById: Readonly<Record<string, ResolveModelChoice>>,
        ) => void
      >();
    render(
      <ResolveBoard
        threads={[thread({ id: 'c1' }), thread({ id: 'c2', threadId: 'PRRT_2' })]}
        onSpawnOne={vi.fn()}
        onSpawnBatch={onSpawnBatch}
        onOpenThread={vi.fn()}
      />,
    );
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Resolve all with/i }));
    });
    act(() => {
      fireEvent.change(screen.getByRole('combobox', { name: /Resolver mode/i }), {
        target: { value: 'analyze' },
      });
      fireEvent.change(screen.getByRole('textbox', { name: /Resolver hint/i }), {
        target: { value: 'Keep the public API stable.' },
      });
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Spawn resolver for 2 comments/i }));
    });
    const choices = onSpawnBatch.mock.calls[0]?.[1];
    expect(choices?.c1).toEqual(
      expect.objectContaining({ mode: 'analyze', hint: 'Keep the public API stable.' }),
    );
    expect(choices?.c2).toEqual(
      expect.objectContaining({ mode: 'analyze', hint: 'Keep the public API stable.' }),
    );
  });

  it('renders the head comment plus its replies as context', () => {
    render(
      <ResolveBoard
        threads={[
          thread({ id: 'c1', body: 'main request' }, [
            comment({ id: 'r1', author: 'bob', body: 'agree, ship it' }),
          ]),
        ]}
        onSpawnOne={vi.fn()}
        onSpawnBatch={vi.fn()}
        onOpenThread={vi.fn()}
      />,
    );
    expect(screen.getByText(/main request/i)).toBeDefined();
    expect(screen.getByText(/agree, ship it/i)).toBeDefined();
    expect(screen.getByText('bob')).toBeDefined();
  });

  it('renders an empty state when there are no open comments', () => {
    render(
      <ResolveBoard
        threads={[]}
        onSpawnOne={vi.fn()}
        onSpawnBatch={vi.fn()}
        onOpenThread={vi.fn()}
      />,
    );
    expect(screen.getByText(/Nothing to resolve/i)).toBeDefined();
  });
});
