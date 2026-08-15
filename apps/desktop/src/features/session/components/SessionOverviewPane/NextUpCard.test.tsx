// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NextUpCard } from './NextUpCard';
import type { NextUpItem, NextUpSignal } from './selectNextUp';

afterEach(cleanup);

const ALL_ITEM_IDS: ReadonlyArray<NextUpItem['id']> = [
  'question',
  'review',
  'checks',
  'resume',
  'resolve',
  'pending-push',
  'stalled',
  'errored',
  'close-out',
  'start',
  'next-step',
  'follow',
];

const ITEM_ICON_GLYPH: Record<NextUpItem['id'], string> = {
  question: 'circle-question-mark',
  review: 'git-pull-request',
  checks: 'circle-x',
  resume: 'bot',
  resolve: 'message-square-reply',
  'pending-push': 'upload',
  stalled: 'waypoints',
  errored: 'circle-alert',
  'close-out': 'git-pull-request',
  start: 'waypoints',
  'next-step': 'waypoints',
  follow: 'bot',
};

const ALL_SIGNAL_IDS: ReadonlyArray<NextUpSignal> = [
  'question',
  'review',
  'checks',
  'resume',
  'stalled',
  'errored',
  'resolve',
];

const SIGNAL_ICON_GLYPH: Record<NextUpSignal, string> = {
  question: 'circle-question-mark',
  review: 'git-pull-request',
  checks: 'circle-x',
  resume: 'bot',
  stalled: 'triangle-alert',
  errored: 'circle-alert',
  resolve: 'message-square-reply',
};

const itemFor = ({ id }: { readonly id: NextUpItem['id'] }): NextUpItem => ({
  id,
  title: `title for ${id}`,
  detail: '',
  action: 'Go',
  tone: 'neutral',
  lens: null,
  itemId: null,
  signals: [],
});

const itemWithSignal = ({ signal }: { readonly signal: NextUpSignal }): NextUpItem => ({
  id: 'question',
  title: 'title',
  detail: '',
  action: 'Go',
  tone: 'neutral',
  lens: null,
  itemId: null,
  signals: [signal],
});

describe('NextUpCard', () => {
  it.each(ALL_ITEM_IDS)('renders the pinned glyph and title for id %s', (id) => {
    const { container } = render(<NextUpCard item={itemFor({ id })} onAct={vi.fn()} />);
    expect(screen.getByText(`title for ${id}`)).toBeDefined();

    const leadingIcon = container.querySelector('svg');
    expect(leadingIcon).not.toBeNull();
    expect(leadingIcon?.classList.contains(`lucide-${ITEM_ICON_GLYPH[id]}`)).toBe(true);
  });

  it.each(ALL_SIGNAL_IDS)('renders the pinned signal glyph for %s', (signal) => {
    const { container } = render(<NextUpCard item={itemWithSignal({ signal })} onAct={vi.fn()} />);

    const icons = container.querySelectorAll('svg');
    expect(icons).toHaveLength(2);
    const signalIcon = icons.item(1);
    expect(signalIcon).not.toBeNull();
    expect(signalIcon?.classList.contains(`lucide-${SIGNAL_ICON_GLYPH[signal]}`)).toBe(true);
  });

  it('renders a chip per signal and dispatches onAct from the primary button', () => {
    const onAct = vi.fn();
    render(
      <NextUpCard
        item={{
          id: 'question',
          title: '1 open question',
          detail: 'What should happen next?',
          action: 'Answer',
          tone: 'warning',
          lens: 'questions',
          itemId: null,
          signals: ['resolve'],
        }}
        onAct={onAct}
      />,
    );

    expect(screen.getByText('1 open question')).toBeDefined();
    expect(screen.getByText('What should happen next?')).toBeDefined();
    expect(screen.getByText('resolve')).toBeDefined();
    screen.getByRole('button', { name: 'Answer' }).click();
    expect(onAct).toHaveBeenCalledTimes(1);
  });
});
