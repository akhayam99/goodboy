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

const setHint = (value: string) => {
  fireEvent.change(screen.getByRole('textbox', { name: /Resolver hint/i }), {
    target: { value },
  });
};

const closePopover = () => {
  fireEvent.keyDown(window, { key: 'Escape' });
};

beforeEach(() => {
  h.providers = [{ id: 'anthropic', connection: 'connected' }];
});
afterEach(cleanup);

describe('ResolveBoard', () => {
  it('counts selected comments and fans out only the selected ones', () => {
    const onSpawnBatch = vi.fn();
    render(
      <ResolveBoard
        roleModels={null}
        threads={[thread({ id: 'c1' }), thread({ id: 'c2', threadId: 'PRRT_2' })]}
        onSpawnOne={vi.fn()}
        onSpawnBatch={onSpawnBatch}
        onSpawnCombined={vi.fn()}
        onOpenThread={vi.fn()}
      />,
    );
    expect(screen.getByText(/Resolve 2 threads/i)).toBeDefined();

    const checkboxes = screen.getAllByRole('checkbox');
    act(() => {
      fireEvent.click(checkboxes[1]!);
    });
    expect(screen.getByText(/Resolve 1 thread/i)).toBeDefined();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Resolve 1 thread/i }));
    });
    expect(onSpawnBatch).toHaveBeenCalledTimes(1);
    const batchArg = onSpawnBatch.mock.calls[0]?.[0] as ReadonlyArray<CommentThread>;
    expect(batchArg.map((t) => t.head.id)).toEqual(['c2']);
  });

  it('spawns a single comment via its Resolve button', () => {
    const onSpawnOne = vi.fn<(thread: CommentThread, choice: ResolveModelChoice) => void>();
    render(
      <ResolveBoard
        roleModels={null}
        threads={[thread({ id: 'c1' })]}
        onSpawnOne={onSpawnOne}
        onSpawnBatch={vi.fn()}
        onSpawnCombined={vi.fn()}
        onOpenThread={vi.fn()}
      />,
    );
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^Resolve$/i }));
    });
    expect(onSpawnOne).toHaveBeenCalledTimes(1);
    expect(onSpawnOne.mock.calls[0]?.[0]?.head?.id).toBe('c1');
    expect(onSpawnOne.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ hint: '' }));
  });

  it('applies the hint from the card popover to that resolver', () => {
    const onSpawnOne = vi.fn<(thread: CommentThread, choice: ResolveModelChoice) => void>();
    render(
      <ResolveBoard
        roleModels={null}
        threads={[thread({ id: 'c1' })]}
        onSpawnOne={onSpawnOne}
        onSpawnBatch={vi.fn()}
        onSpawnCombined={vi.fn()}
        onOpenThread={vi.fn()}
      />,
    );
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Resolve with/i }));
    });
    expect(screen.getByRole('dialog', { name: 'Configure resolver' })).toBeDefined();
    act(() => {
      setHint('Avoid schema changes.');
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Resolve comment' }));
    });
    expect(onSpawnOne.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ hint: 'Avoid schema changes.' }),
    );
  });

  it('keeps a per-card hint on that card only', () => {
    const onSpawnBatch =
      vi.fn<
        (
          threads: ReadonlyArray<CommentThread>,
          choiceById: Readonly<Record<string, ResolveModelChoice>>,
        ) => void
      >();
    render(
      <ResolveBoard
        roleModels={null}
        threads={[thread({ id: 'c1' }), thread({ id: 'c2', threadId: 'PRRT_2' })]}
        onSpawnOne={vi.fn()}
        onSpawnBatch={onSpawnBatch}
        onSpawnCombined={vi.fn()}
        onOpenThread={vi.fn()}
      />,
    );
    act(() => {
      fireEvent.click(screen.getAllByRole('button', { name: /Resolve with/i })[0]!);
    });
    act(() => {
      setHint('Only here.');
    });
    act(() => {
      closePopover();
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Resolve 2 threads/i }));
    });
    const choices = onSpawnBatch.mock.calls[0]?.[1];
    expect(choices?.c1).toEqual(expect.objectContaining({ hint: 'Only here.' }));
    expect(choices?.c2).toEqual(expect.objectContaining({ hint: '' }));
  });

  it('applies batch defaults to cards without an explicit override', () => {
    const onSpawnBatch =
      vi.fn<
        (
          threads: ReadonlyArray<CommentThread>,
          choiceById: Readonly<Record<string, ResolveModelChoice>>,
        ) => void
      >();
    render(
      <ResolveBoard
        roleModels={null}
        threads={[thread({ id: 'c1' }), thread({ id: 'c2', threadId: 'PRRT_2' })]}
        onSpawnOne={vi.fn()}
        onSpawnBatch={onSpawnBatch}
        onSpawnCombined={vi.fn()}
        onOpenThread={vi.fn()}
      />,
    );
    act(() => {
      fireEvent.click(screen.getAllByRole('button', { name: /Resolve with/i })[0]!);
    });
    act(() => {
      setHint('Card override.');
    });
    act(() => {
      closePopover();
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Resolve all with/i }));
    });
    act(() => {
      setHint('Batch default.');
    });
    act(() => {
      closePopover();
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Resolve 2 threads/i }));
    });
    const choices = onSpawnBatch.mock.calls[0]?.[1];
    expect(choices?.c1).toEqual(expect.objectContaining({ hint: 'Card override.' }));
    expect(choices?.c2).toEqual(expect.objectContaining({ hint: 'Batch default.' }));
  });

  it('apply-to-all overwrites every per-card override', () => {
    const onSpawnBatch =
      vi.fn<
        (
          threads: ReadonlyArray<CommentThread>,
          choiceById: Readonly<Record<string, ResolveModelChoice>>,
        ) => void
      >();
    render(
      <ResolveBoard
        roleModels={null}
        threads={[thread({ id: 'c1' }), thread({ id: 'c2', threadId: 'PRRT_2' })]}
        onSpawnOne={vi.fn()}
        onSpawnBatch={onSpawnBatch}
        onSpawnCombined={vi.fn()}
        onOpenThread={vi.fn()}
      />,
    );
    act(() => {
      fireEvent.click(screen.getAllByRole('button', { name: /Resolve with/i })[0]!);
    });
    act(() => {
      setHint('Card override.');
    });
    act(() => {
      closePopover();
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Resolve all with/i }));
    });
    act(() => {
      setHint('Everywhere.');
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply to all cards' }));
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Resolve 2 threads/i }));
    });
    const choices = onSpawnBatch.mock.calls[0]?.[1];
    expect(choices?.c1).toEqual(expect.objectContaining({ hint: 'Everywhere.' }));
    expect(choices?.c2).toEqual(expect.objectContaining({ hint: 'Everywhere.' }));
  });

  it('renders the head comment plus its replies as context', () => {
    render(
      <ResolveBoard
        roleModels={null}
        threads={[
          thread({ id: 'c1', body: 'main request' }, [
            comment({ id: 'r1', author: 'bob', body: 'agree, ship it' }),
          ]),
        ]}
        onSpawnOne={vi.fn()}
        onSpawnBatch={vi.fn()}
        onSpawnCombined={vi.fn()}
        onOpenThread={vi.fn()}
      />,
    );
    expect(screen.getByText(/main request/i)).toBeDefined();
    expect(screen.getByText(/agree, ship it/i)).toBeDefined();
    expect(screen.getByText('bob')).toBeDefined();
  });

  it('marks an outdated thread but not a fresh one', () => {
    render(
      <ResolveBoard
        roleModels={null}
        threads={[
          thread({ id: 'c1', outdated: true }),
          thread({ id: 'c2', threadId: 'PRRT_2', outdated: false }),
        ]}
        onSpawnOne={vi.fn()}
        onSpawnBatch={vi.fn()}
        onSpawnCombined={vi.fn()}
        onOpenThread={vi.fn()}
      />,
    );
    expect(screen.getAllByText('Outdated').length).toBe(1);
  });

  it('renders an empty state when there are no open comments', () => {
    render(
      <ResolveBoard
        roleModels={null}
        threads={[]}
        onSpawnOne={vi.fn()}
        onSpawnBatch={vi.fn()}
        onSpawnCombined={vi.fn()}
        onOpenThread={vi.fn()}
      />,
    );
    expect(screen.getByText(/Nothing to resolve/i)).toBeDefined();
  });

  it('spawns one combined resolver with the batch defaults', () => {
    const onSpawnCombined =
      vi.fn<(threads: ReadonlyArray<CommentThread>, choice: ResolveModelChoice) => void>();
    render(
      <ResolveBoard
        roleModels={null}
        threads={[thread({ id: 'c1' }), thread({ id: 'c2', threadId: 'PRRT_2' })]}
        onSpawnOne={vi.fn()}
        onSpawnBatch={vi.fn()}
        onSpawnCombined={onSpawnCombined}
        onOpenThread={vi.fn()}
      />,
    );
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Resolve all with/i }));
    });
    act(() => {
      setHint('Avoid schema changes.');
    });
    act(() => {
      closePopover();
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Combine into one' }));
    });
    expect(onSpawnCombined).toHaveBeenCalledOnce();
    expect(
      onSpawnCombined.mock.calls[0]?.[0]?.map((item: CommentThread) => item.head.threadId),
    ).toEqual(['PRRT_1', 'PRRT_2']);
    expect(onSpawnCombined.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ hint: 'Avoid schema changes.' }),
    );
  });
});
