// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { AskRightNowLine } from '../../askRightNow';
import { AskRightNow } from './AskRightNow';

afterEach(cleanup);

const LINES: ReadonlyArray<AskRightNowLine> = [
  { key: 'comments', tone: 'needs', lead: '2 comments need you', detail: 'on #318' },
  { key: 'agent-0', tone: 'running', lead: 'Implementer running', detail: '4 min' },
  { key: 'cost', tone: 'cost', lead: '$1.20 in this session', detail: null },
];

describe('AskRightNow lines', () => {
  it('puts every mark in the line-mark slot, before the words it belongs to', () => {
    render(
      <AskRightNow
        lines={LINES}
        suggestions={[]}
        isFolded={false}
        onUnfold={vi.fn()}
        onAsk={vi.fn()}
      />,
    );

    const items = within(screen.getByTestId('ask-right-now')).getAllByRole('listitem');
    expect(items).toHaveLength(LINES.length);
    items.forEach((item) => {
      const mark = item.querySelector('[data-slot="line-mark"]');
      expect(mark).not.toBeNull();
      expect(item.firstElementChild).toBe(mark);
      expect(mark?.nextElementSibling?.textContent).not.toBe('');
    });
    expect(items[0]?.querySelector('[data-slot="line-mark"] [role="img"]')).not.toBeNull();
    expect(items[2]?.querySelector('[data-slot="line-mark"] svg')).not.toBeNull();
  });
});
