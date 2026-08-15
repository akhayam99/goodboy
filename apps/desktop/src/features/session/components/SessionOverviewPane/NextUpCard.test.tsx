// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NextUpCard } from './NextUpCard';
import type { NextUpItem } from './selectNextUp';

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

describe('NextUpCard', () => {
  it.each(ALL_ITEM_IDS)('renders an icon and the title for id %s without crashing', (id) => {
    render(<NextUpCard item={itemFor({ id })} onAct={vi.fn()} />);
    expect(screen.getByText(`title for ${id}`)).toBeDefined();
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
