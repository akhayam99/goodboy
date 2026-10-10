// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Button } from '../components/Button';
import { HeaderActions } from '../components/HeaderActions';
import { OverflowMenu } from '../components/OverflowMenu';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const TWO = [
  { kind: 'item' as const, key: 'one', label: 'One', onClick: vi.fn() },
  { kind: 'item' as const, key: 'two', label: 'Two', onClick: vi.fn() },
];

describe('HeaderActions', () => {
  it('draws secondary, button, primary and overflow in that order whatever the props order', () => {
    render(
      <HeaderActions
        overflow={<OverflowMenu items={TWO} size="control" />}
        primary={<Button variant="primary">Merge</Button>}
        button={<Button variant="secondary">Abort</Button>}
        secondary={<input aria-label="Filter" />}
      />,
    );

    const order = Array.from(
      document.querySelectorAll('[data-slot="header-actions"] > [data-slot]'),
    ).map((slot) => slot.getAttribute('data-slot'));
    expect(order).toEqual([
      'header-actions-secondary',
      'header-actions-button',
      'header-actions-primary',
      'header-actions-overflow',
    ]);
  });

  it('draws an empty slot as nothing', () => {
    render(<HeaderActions primary={<Button>Merge</Button>} button={null} secondary={false} />);

    expect(document.querySelectorAll('[data-slot^="header-actions-"]')).toHaveLength(1);
    expect(document.querySelector('[data-slot="header-actions-primary"]')).not.toBeNull();
  });

  it('draws nothing at all when every slot is empty', () => {
    const { container } = render(<HeaderActions />);

    expect(container.firstChild).toBeNull();
  });

  it('draws no overflow content for an overflow without items', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <HeaderActions primary={<Button>Merge</Button>} overflow={<OverflowMenu items={[]} />} />,
    );

    const slot = document.querySelector('[data-slot="header-actions-overflow"]');
    expect(slot?.className).toContain('empty:hidden');
    expect(slot?.childElementCount).toBe(0);
    expect(screen.queryByRole('button', { name: /more actions/i })).toBeNull();
  });

  it('hides the whole group when its only content renders nothing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<HeaderActions overflow={<OverflowMenu items={[]} />} />);

    const group = document.querySelector('[data-slot="header-actions"]');
    expect(group?.className).toContain('hidden');
    expect(group?.className).toContain('has-[>:not(:empty)]:flex');
  });

  it('keeps every slot 28 tall and the group on the right edge', () => {
    render(
      <HeaderActions
        secondary={<span>filter</span>}
        button={<Button variant="secondary">Abort</Button>}
        primary={<Button variant="primary">Merge</Button>}
        overflow={<OverflowMenu items={TWO} size="control" />}
      />,
    );

    const group = document.querySelector('[data-slot="header-actions"]');
    expect(group?.className).toContain('h-7');
    expect(group?.className).toContain('justify-end');
    for (const slot of Array.from(group?.children ?? [])) {
      expect(slot.className).toContain('h-7');
    }
    expect(screen.getByRole('button', { name: 'Merge' }).getAttribute('data-size')).toBe('sm');
  });

  it('lets a caller fold one slot at a narrow container', () => {
    render(
      <HeaderActions
        slotClassNames={{ button: '@max-[560px]:hidden' }}
        button={<Button variant="ghost">Close</Button>}
      />,
    );

    expect(document.querySelector('[data-slot="header-actions-button"]')?.className).toContain(
      '@max-[560px]:hidden',
    );
  });

  it('counts one filled primary through the variant attribute', () => {
    render(
      <HeaderActions
        button={<Button variant="secondary">Abort</Button>}
        primary={<Button variant="primary">Merge</Button>}
      />,
    );

    expect(document.querySelectorAll('button[data-variant="primary"]')).toHaveLength(1);
  });
});
