// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { registerEscapeLayer } from '@goodboy/ui';
import type { QuickActionItem } from '../types';
import { QuickActionsPopover } from './index';

afterEach(cleanup);

const ITEMS: ReadonlyArray<QuickActionItem> = [
  { id: 'a', label: 'Open storefront-web', group: 'session', perform: () => undefined },
  { id: 'b', label: 'Open payments-api', group: 'session', perform: () => undefined },
];

const press = (key: string) => fireEvent.keyDown(window, { key, code: key });

describe('QuickActionsPopover', () => {
  it('opens outside a clipping 320px composer, so the composer cannot cut the list', () => {
    render(
      <div data-testid="clip" style={{ width: 320, overflow: 'hidden' }}>
        <div className="relative">
          <QuickActionsPopover
            items={ITEMS}
            emptyHint="Nothing here"
            onSelect={vi.fn()}
            onDismiss={vi.fn()}
          />
        </div>
      </div>,
    );

    const row = screen.getByText('Open payments-api');
    expect(screen.getByTestId('clip').contains(row)).toBe(false);
    expect(row.closest('[data-anchored-layer]')?.parentElement).toBe(document.body);
  });

  it('moves through the list with the arrows and picks with Enter', () => {
    const onSelect = vi.fn();
    render(
      <QuickActionsPopover
        items={ITEMS}
        emptyHint="Nothing here"
        onSelect={onSelect}
        onDismiss={vi.fn()}
      />,
    );

    press('ArrowDown');
    press('Enter');

    expect(onSelect).toHaveBeenCalledWith(ITEMS[1]);
  });

  it('dismisses on Escape, and leaves it to a layer opened above it', () => {
    const onDismiss = vi.fn();
    const closeAbove = vi.fn();
    render(
      <QuickActionsPopover
        items={ITEMS}
        emptyHint="Nothing here"
        onSelect={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    const offAbove = registerEscapeLayer(closeAbove);

    press('Escape');
    expect(closeAbove).toHaveBeenCalledOnce();
    expect(onDismiss).not.toHaveBeenCalled();

    offAbove();
    press('Escape');
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
