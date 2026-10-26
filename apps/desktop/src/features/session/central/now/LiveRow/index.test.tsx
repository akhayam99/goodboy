// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LiveRow } from '.';

afterEach(cleanup);

type RowParams = {
  readonly title: string;
  readonly where?: string | null;
};

const renderRow = ({ title, where = null }: RowParams) =>
  render(
    <LiveRow
      glyph={null}
      kindWord="Implementer"
      title={title}
      openLabel="Open the agent"
      onOpen={vi.fn()}
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

  it('keeps a title that adds something to the kind', () => {
    renderRow({ title: 'Add the stuck-delivery banner' });

    screen.getByText('Implementer');
    expect(screen.getByRole('button', { name: 'Open the agent' }).textContent).toBe(
      'ImplementerAdd the stuck-delivery banner',
    );
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
    render(
      <LiveRow
        glyph={<svg data-testid="glyph" />}
        kindWord="Implementer"
        title="Add the stuck-delivery banner"
        openLabel="Open the agent"
        onOpen={vi.fn()}
        where={null}
        end={<button type="button">Answer</button>}
        time={<span>14m 43s</span>}
      />,
    );

    const lead = document.querySelector('[data-live-lead]');
    const open = screen.getByRole('button', { name: 'Open the agent' });
    expect(lead?.contains(screen.getByTestId('glyph'))).toBe(true);
    expect(lead?.contains(open)).toBe(true);
    expect(lead?.parentElement).toBe(document.querySelector('[data-live-row]'));
  });

  it('keeps a long path whole in one clamped element', () => {
    const path = 'apps/desktop/src/features/session/central/now/LiveRow/index.tsx';
    renderRow({ title: path });

    const open = screen.getByRole('button', { name: 'Open the agent' });
    expect(open.textContent).toBe(`Implementer${path}`);
    const title = screen.getByText(path);
    expect(title.textContent).toBe(path);
    expect(title.children).toHaveLength(0);
    expect(title.parentElement).toBe(open);
  });

  it('keeps a title with no spaces whole in one clamped element', () => {
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
});
