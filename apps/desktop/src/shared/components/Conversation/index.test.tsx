// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureMessage, fixtureSource, fixtureThread } from './conversationFixtures';
import type { ConversationSource } from './types';
import { useConversationPane } from './useConversationPane';

type HarnessProps = {
  readonly source: ConversationSource;
};

const Harness = ({ source }: HarnessProps) => {
  const pane = useConversationPane({ source, resetKey: 'item-1' });
  return (
    <div>
      {pane.section.content}
      {pane.composer}
    </div>
  );
};

const ROBIN = fixtureMessage({ id: 'm1', name: 'Robin Vale', body: '500 feels high for the job.' });
const SAM = fixtureMessage({
  id: 'm2',
  name: 'Sam Kerr',
  body: 'Moved to config.',
  createdAt: '2026-09-20T11:00:00Z',
});
const THREAD = fixtureThread({ head: ROBIN, replies: [SAM], anchor: 'settle/batch.ts:48' });

const type = (value: string) =>
  fireEvent.change(screen.getByRole('textbox'), { target: { value } });

const sendWithShortcut = () =>
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', metaKey: true });

afterEach(cleanup);

describe('Conversation', () => {
  it('draws a thread head with its code anchor and its replies', () => {
    render(<Harness source={fixtureSource({ threads: [THREAD] })} />);

    screen.getByText('settle/batch.ts:48');
    screen.getByText('Robin Vale');
    expect(screen.getByRole('list', { name: 'Replies' }).textContent).toContain('Moved to config.');
  });

  it('shows no composer when the tool cannot write', () => {
    render(<Harness source={fixtureSource({ threads: [THREAD] })} />);

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();
  });

  it('starts a new thread by default', async () => {
    const onPost = vi.fn(async () => undefined);
    render(<Harness source={fixtureSource({ threads: [THREAD], onPost })} />);

    screen.getByPlaceholderText('Start a new thread');
    type('Can we get a test for the rollback?');
    sendWithShortcut();

    await waitFor(() =>
      expect(onPost).toHaveBeenCalledWith({
        body: 'Can we get a test for the rollback?',
        threadId: null,
      }),
    );
  });

  it('replies into the thread of the message Reply was clicked on', async () => {
    const onPost = vi.fn(async () => undefined);
    render(<Harness source={fixtureSource({ threads: [THREAD], onPost })} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Reply' })[1]!);
    screen.getByText('Replying to');
    type('Thanks');
    sendWithShortcut();

    await waitFor(() =>
      expect(onPost).toHaveBeenCalledWith({ body: 'Thanks', threadId: THREAD.id }),
    );
  });

  it('sets the reply target with r on a focused message and clears it with Escape', () => {
    render(
      <Harness
        source={fixtureSource({ threads: [THREAD], onPost: vi.fn(async () => undefined) })}
      />,
    );

    fireEvent.keyDown(screen.getByRole('article', { name: 'Message from Robin Vale' }), {
      key: 'r',
    });
    screen.getByText('Replying to');
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });

    expect(screen.queryByText('Replying to')).toBeNull();
    screen.getByPlaceholderText('Start a new thread');
  });

  it('keeps a refused message in place with its text and a retry', async () => {
    const onPost = vi
      .fn<(params: { body: string; threadId: string | null }) => Promise<void>>()
      .mockRejectedValueOnce(new Error('Northwind refused the comment (403)'))
      .mockResolvedValueOnce(undefined);
    render(<Harness source={fixtureSource({ threads: [THREAD], onPost })} />);

    type('We need a backfill');
    sendWithShortcut();

    await screen.findByText("Didn't post");
    screen.getByText('We need a backfill');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });
    expect(onPost).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByText("Didn't post")).toBeNull());
  });

  it('quotes the message and mentions its author on a flat tool', async () => {
    const onPost = vi.fn(async () => undefined);
    const flat = fixtureThread({
      head: fixtureMessage({
        id: 'c1',
        name: 'ana-r',
        handle: 'ana-r',
        body: 'Paging breaks export.',
      }),
    });
    render(
      <Harness
        source={fixtureSource({
          threads: [flat],
          onPost,
          capabilities: { reply: 'quote', startThread: true, resolve: false, react: false },
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Quote' }));
    screen.getByText('Quoting');
    type('agreed');
    sendWithShortcut();

    await waitFor(() =>
      expect(onPost).toHaveBeenCalledWith({
        body: '> Paging breaks export.\n\n@ana-r agreed',
        threadId: null,
      }),
    );
  });

  it('folds a resolved thread into one row that opens on click', () => {
    const resolved = fixtureThread({ head: ROBIN, replies: [SAM], isResolved: true });
    render(<Harness source={fixtureSource({ threads: [resolved] })} />);

    expect(screen.queryByText('500 feels high for the job.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Resolved thread · Robin Vale · 1 reply/ }));

    screen.getByText('500 feels high for the job.');
  });

  it('resolves a thread from its head', () => {
    const onResolve = vi.fn(async () => undefined);
    render(
      <Harness
        source={fixtureSource({ threads: [{ ...THREAD, isResolved: false }], onResolve })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));

    expect(onResolve).toHaveBeenCalledWith({ threadId: THREAD.id, isResolved: true });
  });

  it('keeps only the last three replies open', () => {
    const replies = [1, 2, 3, 4, 5].map((index) =>
      fixtureMessage({
        id: `r${index}`,
        name: `Replier ${index}`,
        body: `reply ${index}`,
        createdAt: `2026-09-20T1${index}:00:00Z`,
      }),
    );
    render(
      <Harness source={fixtureSource({ threads: [fixtureThread({ head: ROBIN, replies })] })} />,
    );

    expect(screen.queryByText('reply 2')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 earlier replies' }));

    screen.getByText('reply 1');
  });

  it('drops the header of a quick follow-up from the same author', () => {
    const first = fixtureThread({
      head: fixtureMessage({ id: 's1', name: 'Jun Ota', body: 'Queue at 4k.' }),
    });
    const second = fixtureThread({
      head: fixtureMessage({
        id: 's2',
        name: 'Jun Ota',
        body: 'Rolling back.',
        createdAt: '2026-09-20T10:02:00Z',
      }),
    });
    render(<Harness source={fixtureSource({ threads: [first, second] })} />);

    expect(screen.getAllByText('Jun Ota')).toHaveLength(1);
  });

  it('shows the empty state and the loading skeleton', () => {
    const { rerender } = render(<Harness source={fixtureSource({ threads: [] })} />);
    screen.getByText('No comments yet');

    rerender(<Harness source={fixtureSource({ threads: [], isLoading: true })} />);
    screen.getByRole('status', { name: 'Loading the conversation' });
  });
});
