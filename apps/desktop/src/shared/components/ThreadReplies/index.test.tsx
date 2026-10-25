// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ThreadReplies } from '.';
import type { ThreadReplyItem } from './threadReplyItem';

afterEach(cleanup);

const reply = (id: string, author: string, body: string): ThreadReplyItem => ({
  id,
  author,
  body,
  createdAt: '2026-10-20T09:00:00.000Z',
  avatarUrl: null,
});

const TWO = [
  reply('r1', 'northwind-dev', 'Please take the transaction.\nIt is passed in.'),
  reply('r2', 'acme-bot', 'Done in the next commit.'),
];

const THREE = [...TWO, reply('r3', 'northwind-dev', 'Thanks.')];

describe('ThreadReplies', () => {
  it('renders nothing without replies', () => {
    const view = render(<ThreadReplies replies={[]} />);

    expect(view.container.firstChild).toBeNull();
  });

  it('collapsed mode shows one line per reply: the author and the first line', () => {
    render(<ThreadReplies replies={TWO} mode="collapsed" />);

    const list = screen.getByRole('list', { name: 'Replies' });
    const rows = within(list).getAllByRole('listitem');

    expect(rows.map((row) => row.textContent)).toEqual([
      'northwind-devPlease take the transaction.',
      'acme-botDone in the next commit.',
    ]);
  });

  it('full mode shows every reply with its author while there are two or fewer', () => {
    render(<ThreadReplies replies={TWO} />);

    expect(screen.getByText('northwind-dev').textContent).toBe('northwind-dev');
    expect(screen.getByText('acme-bot').textContent).toBe('acme-bot');
    expect(screen.queryByRole('button', { name: /replies/ })).toBeNull();
  });

  it('full mode folds three replies behind a count and opens them on click', () => {
    render(<ThreadReplies replies={THREE} />);

    const toggle = screen.getByRole('button', { name: '3 replies' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('list', { name: 'Replies' })).toBeNull();

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(
      within(screen.getByRole('list', { name: 'Replies' })).getAllByRole('listitem'),
    ).toHaveLength(3);
  });

  it('clamps a bot reply and not a person', () => {
    render(
      <ThreadReplies
        replies={[
          { ...reply('r1', 'acme-bot[bot]', 'a\nb\nc\nd\ne\nf'), isBot: true },
          reply('r2', 'northwind-dev', 'short'),
        ]}
      />,
    );

    expect(screen.getByText('acme-bot[bot]').textContent).toBe('acme-bot[bot]');
    expect(screen.getByText('short').textContent).toBe('short');
  });
});
