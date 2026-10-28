// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LiveRow } from '.';

afterEach(cleanup);

type RowParams = {
  readonly title: string;
  readonly where?: string | null;
  readonly reason?: string | null;
  readonly onOpen?: () => void;
};

const renderRow = ({ title, where = null, reason = null, onOpen = vi.fn() }: RowParams) =>
  render(
    <LiveRow
      glyph={<svg data-testid="glyph" />}
      kindWord="Implementer"
      title={title}
      reason={reason}
      openLabel="Open the agent"
      onOpen={onOpen}
      where={where}
      end={<button type="button">Answer</button>}
      time={<span>14m 43s</span>}
    />,
  );

describe('a row in the Running card', () => {
  it('says the kind once when the title is the kind', () => {
    renderRow({ title: 'Implementer' });

    expect(screen.getAllByText('Implementer')).toHaveLength(1);
  });

  it('keeps a title that adds something to the kind on the same line', () => {
    renderRow({ title: 'Add the stuck-delivery banner' });

    const kind = screen.getByText('Implementer');
    const title = screen.getByText('Add the stuck-delivery banner');
    expect(title.parentElement).toBe(kind.parentElement);
  });

  it('opens the row from a button that covers the whole row', () => {
    const onOpen = vi.fn();
    renderRow({ title: 'Add the stuck-delivery banner', onOpen });

    const open = screen.getByRole('button', { name: 'Open the agent' });
    expect(open.parentElement).toBe(document.querySelector('[data-live-row]'));
    fireEvent.click(open);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('keeps the action and the duration in one group that moves together', () => {
    renderRow({ title: 'Add the stuck-delivery banner' });

    const action = screen.getByRole('button', { name: 'Answer' });
    const duration = screen.getByText('14m 43s');
    expect(action.parentElement?.parentElement).toBe(duration.parentElement?.parentElement);
  });

  it('reserves no width for a place it does not have', () => {
    renderRow({ title: 'Add the stuck-delivery banner' });

    expect(document.querySelector('[data-live-where]')).toBeNull();
  });

  it('shows the place when there is one', () => {
    renderRow({ title: 'Add the stuck-delivery banner', where: 'payments-api' });

    screen.getByText('payments-api');
  });

  it('keeps the glyph and the title in one group that never wraps apart', () => {
    renderRow({ title: 'Add the stuck-delivery banner' });

    const lead = document.querySelector('[data-live-lead]');
    expect(lead?.contains(screen.getByTestId('glyph'))).toBe(true);
    expect(lead?.contains(screen.getByText('Add the stuck-delivery banner'))).toBe(true);
    expect(lead?.parentElement).toBe(document.querySelector('[data-live-row]'));
  });

  it('keeps a long path whole in one element', () => {
    const path = 'apps/desktop/src/features/session/central/now/LiveRow/index.tsx';
    renderRow({ title: path });

    const title = screen.getByText(path);
    expect(title.textContent).toBe(path);
    expect(title.children).toHaveLength(0);
  });

  it('keeps a title with no spaces whole in one element', () => {
    const text = '配信の停止を通知リレーで再試行する';
    renderRow({ title: text });

    const title = screen.getByText(text);
    expect(title.textContent).toBe(text);
    expect(title.children).toHaveLength(0);
  });

  it('holds a spaced title as one text node, never split into words', () => {
    renderRow({ title: 'Surface retry state in notify-relay' });

    const title = screen.getByText('Surface retry state in notify-relay');
    expect(title.children).toHaveLength(0);
  });

  it('draws no second line without a reason', () => {
    renderRow({ title: 'Add the stuck-delivery banner' });

    expect(document.querySelector('[data-live-reason]')).toBeNull();
  });

  it('draws the reason as a second line under the title', () => {
    renderRow({ title: 'Add the stuck-delivery banner', reason: 'Origin moved' });

    const reason = document.querySelector('[data-live-reason]');
    expect(reason?.textContent).toBe('Origin moved');
    expect(document.querySelectorAll('[data-live-row] [data-live-reason]')).toHaveLength(1);
  });

  it('keeps the action clickable above the open button', () => {
    const onOpen = vi.fn();
    renderRow({ title: 'Add the stuck-delivery banner', onOpen });

    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(onOpen).not.toHaveBeenCalled();
  });
});
