// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { POPOVER_WIDTH_PX } from '@goodboy/ui';
import type { AutoLimitKind } from './autoLimitCopy';
import { AutoLimitChip } from './AutoLimitChip';
import type { LimitDefaultFrom } from './limitDefaultFrom';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type LimitParams = {
  readonly usd: number | null;
  readonly isDefault?: boolean;
  readonly defaultUsd?: number | null;
  readonly isFromSession?: boolean;
  readonly defaultFrom?: LimitDefaultFrom;
  readonly change?: (usd: number | null) => void;
};

const limitOf = ({
  usd,
  isDefault = false,
  defaultUsd = null,
  isFromSession = false,
  defaultFrom = 'auto',
  change = vi.fn(),
}: LimitParams) => ({ usd, isDefault, defaultUsd, isFromSession, defaultFrom, change });

type ChipParams = LimitParams & {
  readonly kind?: AutoLimitKind;
};

const chip = ({ kind = 'autoAgent', ...limit }: ChipParams) => (
  <AutoLimitChip limit={limitOf(limit)} kind={kind} isDisabled={false} />
);

type PlaceParams = {
  readonly rect: DOMRect;
};

const placeChip = ({ rect }: PlaceParams): void => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const isChip = this.tagName === 'BUTTON' && (this.textContent ?? '').startsWith('Limit');
    return isChip ? rect : new DOMRect(0, 0, 0, 0);
  });
};

describe('AutoLimitChip', () => {
  it('shows the limit, opens a field and hands back a valid amount', () => {
    const change = vi.fn();
    render(chip({ usd: 5, change }));

    fireEvent.click(screen.getByRole('button', { name: 'Limit $5.00' }));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '8' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use this limit' }));

    expect(change).toHaveBeenCalledWith(8);
  });

  it('takes an amount with cents typed into the field', async () => {
    const change = vi.fn();
    const user = userEvent.setup();
    render(chip({ usd: 5, change }));

    await user.click(screen.getByRole('button', { name: 'Limit $5.00' }));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '2.50');
    await user.click(screen.getByRole('button', { name: 'Use this limit' }));

    expect(change).toHaveBeenCalledWith(2.5);
  });

  it('refuses an amount that is not above zero and says so', () => {
    const change = vi.fn();
    render(chip({ usd: 5, change }));

    fireEvent.click(screen.getByRole('button', { name: 'Limit $5.00' }));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '0' },
    });

    screen.getByText('Enter an amount more than zero.');
    expect(screen.getByRole('button', { name: 'Use this limit' })).toHaveProperty('disabled', true);
    expect(change).not.toHaveBeenCalled();
  });

  it('shows no limit when none is set and offers no clear action', () => {
    render(chip({ usd: null }));

    fireEvent.click(screen.getByRole('button', { name: 'No limit' }));

    expect(screen.getByRole('textbox')).toHaveProperty('value', '');
    expect(
      within(screen.getByRole('dialog')).queryByRole('button', { name: 'No limit' }),
    ).toBeNull();
  });

  it('removes the limit with the No limit action', () => {
    const change = vi.fn();
    render(chip({ usd: 5, change }));

    fireEvent.click(screen.getByRole('button', { name: 'Limit $5.00' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'No limit' }));

    expect(change).toHaveBeenCalledWith(null);
  });

  it('is a plain chip when the budget of the session sets the limit', () => {
    render(chip({ usd: 25, isFromSession: true }));

    screen.getByText('Limit $25.00');
    expect(screen.queryByRole('button', { name: 'Limit $25.00' })).toBeNull();
  });

  it('speaks of the Auto limit when the amount comes from it, whatever the run kind', () => {
    render(chip({ usd: 5, kind: 'orchestrated', defaultFrom: 'auto' }));

    fireEvent.click(screen.getByRole('button', { name: 'Limit $5.00' }));

    screen.getByText(/Other runs in this workspace start from the same limit\./);
    expect(screen.queryByText(/Run defaults/)).toBeNull();
  });

  it('speaks of the Run defaults when the amount comes from them', () => {
    render(chip({ usd: 8, kind: 'preset', defaultFrom: 'run' }));

    fireEvent.click(screen.getByRole('button', { name: 'Limit $8.00' }));

    screen.getByText(/Run defaults set where new runs start\./);
    expect(screen.queryByText(/Other runs in this workspace/)).toBeNull();
  });

  it('tags the amount as the default only while it came from the default', () => {
    const { rerender } = render(chip({ usd: 5, defaultUsd: 5, isDefault: true }));

    screen.getByRole('button', { name: 'Limit $5.00 · default' });

    rerender(chip({ usd: 8, defaultUsd: 5, isDefault: false }));

    screen.getByRole('button', { name: 'Limit $8.00' });
    expect(screen.queryByText('· default')).toBeNull();
  });

  it('keeps a typed amount next to the presets and the default, and picks one in a click', () => {
    const change = vi.fn();
    render(chip({ usd: 8, defaultUsd: 3, change }));

    fireEvent.click(screen.getByRole('button', { name: 'Limit $8.00' }));
    const amounts = within(screen.getByRole('group', { name: 'Amounts' }));

    expect(amounts.getAllByRole('button').map((button) => button.textContent)).toEqual([
      '$3.00default',
      '$5.00',
      '$8.00',
      '$10.00',
      '$25.00',
    ]);
    expect(amounts.getByRole('button', { name: '$8.00' }).getAttribute('aria-pressed')).toBe(
      'true',
    );

    fireEvent.click(amounts.getByRole('button', { name: '$10.00' }));

    expect(change).toHaveBeenCalledWith(10);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([
    ['orchestrated', 'Limit for this run'],
    ['preset', 'Limit for this run'],
    ['autoAgent', 'Limit for this Auto run'],
  ] as const)('names the %s kind in the popover title', (kind, title) => {
    render(chip({ usd: 5, kind }));

    fireEvent.click(screen.getByRole('button', { name: 'Limit $5.00' }));
    const dialog = screen.getByRole('dialog', { name: title });

    within(dialog).getByText(title);
    if (kind !== 'autoAgent') {
      expect(dialog.textContent).not.toContain('Auto');
    }
  });

  it('opens on the design system popover, under its chip, inside the window, at a fixed width', () => {
    placeChip({ rect: new DOMRect(window.innerWidth - 120, 100, 80, 24) });
    render(chip({ usd: 5 }));

    fireEvent.click(screen.getByRole('button', { name: 'Limit $5.00' }));
    const dialog = screen.getByRole('dialog');

    expect(dialog.closest('[data-dropdown-portal]')?.parentElement).toBe(document.body);
    expect(dialog.style.top).toBe('128px');
    expect(Number.parseFloat(dialog.style.left)).toBe(
      window.innerWidth - POPOVER_WIDTH_PX.standard - 8,
    );
    expect(Number.parseFloat(dialog.style.maxHeight)).toBeGreaterThan(0);
  });

  it('flips above the chip when there is no room below', () => {
    placeChip({ rect: new DOMRect(40, window.innerHeight - 40, 80, 24) });
    render(chip({ usd: 5 }));

    fireEvent.click(screen.getByRole('button', { name: 'Limit $5.00' }));
    const dialog = screen.getByRole('dialog');

    expect(dialog.style.top).toBe('');
    expect(dialog.style.bottom).toBe('44px');
    expect(dialog.style.left).toBe('40px');
  });
});
