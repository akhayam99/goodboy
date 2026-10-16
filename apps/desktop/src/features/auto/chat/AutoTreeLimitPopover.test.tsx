import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { capTextOf, type AutoBudgetFacts } from '@goodboy/core';
import { AutoTreeLimitPopover } from './AutoTreeLimitPopover';
import type { AutoTreeCapSave } from './useAutoTreeCap';
import { AUTO_LIMIT_COPY } from './autoLimitCopy';

const CAPPED: AutoBudgetFacts = {
  capUsd: 5,
  spentUsd: 4.8,
  reservedUsd: 0,
  remainingUsd: 0.2,
  hasEstimate: false,
};

type RenderParams = {
  readonly onSave: AutoTreeCapSave;
  readonly facts?: AutoBudgetFacts;
  readonly isFromSession?: boolean;
};

const renderPopover = ({ onSave, facts = CAPPED, isFromSession = false }: RenderParams) => {
  render(<AutoTreeLimitPopover facts={facts} isFromSession={isFromSession} onSave={onSave} />);
  fireEvent.click(screen.getByRole('button', { name: capTextOf({ facts }) }));
  return screen.getByRole('dialog', { name: 'Limit for this conversation' });
};

describe('AutoTreeLimitPopover', () => {
  afterEach(cleanup);

  it('raises the limit from the value it read and closes', async () => {
    const onSave = vi.fn().mockResolvedValue(null);
    renderPopover({ onSave });

    fireEvent.click(screen.getByRole('button', { name: '$10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set limit' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onSave).toHaveBeenCalledWith({ expectedCapUsd: 5, capUsd: 10 });
  });

  it('refuses a custom amount under spent and reserved before it saves', () => {
    const onSave = vi.fn();
    renderPopover({ onSave });

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Custom limit in dollars'), {
      target: { value: '4.00' },
    });

    expect(screen.getByText('The limit must cover spent and reserved usage.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Set limit' }).hasAttribute('disabled')).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('refuses more than two decimals', () => {
    renderPopover({ onSave: vi.fn() });

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Custom limit in dollars'), {
      target: { value: '12.345' },
    });

    expect(
      screen.getByText('Enter an amount more than zero, with at most 2 decimals.'),
    ).toBeDefined();
  });

  it('keeps the popover open with the failure and lets the user retry', async () => {
    const onSave = vi
      .fn()
      .mockResolvedValueOnce(AUTO_LIMIT_COPY.saveFailed)
      .mockResolvedValueOnce(null);
    renderPopover({ onSave });

    fireEvent.click(screen.getByRole('button', { name: '$20' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set limit' }));

    expect(await screen.findByText(AUTO_LIMIT_COPY.saveFailed)).toBeDefined();
    expect(screen.getByRole('dialog')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Set limit' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('sets No cap and sends a missing cap', async () => {
    const onSave = vi.fn().mockResolvedValue(null);
    renderPopover({ onSave });

    fireEvent.click(screen.getByRole('button', { name: 'No cap' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set limit' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onSave).toHaveBeenCalledWith({ expectedCapUsd: 5, capUsd: null });
  });

  it('reads No cap on the trigger and can put a limit back', async () => {
    const onSave = vi.fn().mockResolvedValue(null);
    renderPopover({
      onSave,
      facts: { ...CAPPED, capUsd: null, remainingUsd: null },
    });

    fireEvent.click(screen.getByRole('button', { name: '$10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set limit' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ expectedCapUsd: null, capUsd: 10 }));
  });

  it('keeps No cap off while a session budget sets the limit', () => {
    renderPopover({ onSave: vi.fn(), isFromSession: true });

    expect(screen.getByRole('button', { name: 'No cap' }).hasAttribute('disabled')).toBe(true);
    expect(
      screen.getByText('The session budget sets this limit, so it keeps a cap.'),
    ).toBeDefined();
  });

  it('says when another window changed the limit first', async () => {
    renderPopover({ onSave: vi.fn().mockResolvedValue(AUTO_LIMIT_COPY.stale) });

    fireEvent.click(screen.getByRole('button', { name: '$10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set limit' }));

    expect(await screen.findByText(AUTO_LIMIT_COPY.stale)).toBeDefined();
  });
});
