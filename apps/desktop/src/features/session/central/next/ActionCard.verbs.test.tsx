// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ActionCardModel } from './actionCardsOf';
import { ActionCard } from './ActionCard';
import type { CardActions, CardVerb } from './useActionCardActions';

afterEach(cleanup);

const cardOf = (id: string): ActionCardModel => ({
  id,
  band: 2,
  priority: 44,
  kind: 'rebase',
  title: 'Merge #618',
  detail: 'Approved, checks passed',
  mountId: null,
  source: {
    kind: 'owner',
    owner: {
      id: `owner:${id}`,
      kind: 'rebase',
      text: 'Merge #618',
      where: null,
      at: '2026-10-22T10:00:00.000Z',
      item: null,
      question: null,
      questionIds: [],
      prNumber: null,
      owed: null,
      mountId: null,
    },
  },
  folded: [],
});

const verbOf = (overrides: Partial<CardVerb>): CardVerb => ({
  label: 'Merge',
  ariaLabel: undefined,
  isDisabled: false,
  isBusy: false,
  confirmRole: null,
  confirm: null,
  hasPicker: false,
  run: vi.fn(),
  ...overrides,
});

const actionsOf = (main: CardVerb): CardActions => ({
  main,
  second: null,
  failure: null,
  isBusy: false,
  agentKind: null,
  menu: null,
  foldedTarget: null,
});

describe('the main verb of an action card', () => {
  it('acts right away when the verb needs no confirm', () => {
    const run = vi.fn();
    render(<ActionCard card={cardOf('a')} actions={actionsOf(verbOf({ run }))} isFirst />);

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    expect(run).toHaveBeenCalledOnce();
  });

  it('asks in a popover instead of acting on the first click', () => {
    const run = vi.fn();
    render(
      <ActionCard
        card={cardOf('a')}
        actions={actionsOf(verbOf({ run, confirmRole: 'primary' }))}
        isFirst
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    expect(run).not.toHaveBeenCalled();
    screen.getByRole('dialog', { name: 'Merge?' });
  });

  it('acts once the popover confirm is clicked', () => {
    const run = vi.fn();
    render(
      <ActionCard
        card={cardOf('a')}
        actions={actionsOf(verbOf({ run, confirmRole: 'primary' }))}
        isFirst
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Merge?' })).getByRole('button', { name: 'Merge' }),
    );

    expect(run).toHaveBeenCalledOnce();
  });

  it('disarms on Cancel without acting', () => {
    const run = vi.fn();
    render(
      <ActionCard
        card={cardOf('a')}
        actions={actionsOf(verbOf({ run, confirmRole: 'primary' }))}
        isFirst
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(run).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('disarms when the card switches to a different one', () => {
    const actions = actionsOf(verbOf({ confirmRole: 'primary' }));
    const { rerender } = render(<ActionCard card={cardOf('a')} actions={actions} isFirst />);
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    screen.getByRole('button', { name: 'Cancel' });

    rerender(<ActionCard card={cardOf('b')} actions={actions} isFirst />);

    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('shows a busy verb as busy and refuses a second click', () => {
    const run = vi.fn();
    render(
      <ActionCard
        card={cardOf('a')}
        actions={actionsOf(verbOf({ run, isBusy: true, isDisabled: true }))}
        isFirst
      />,
    );

    const button = screen.getByRole('button', { name: 'Merge' });
    fireEvent.click(button);

    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(run).not.toHaveBeenCalled();
  });

  it('keeps a long verb name for screen readers behind the short visible label', () => {
    render(
      <ActionCard
        card={cardOf('a')}
        actions={actionsOf(verbOf({ label: 'Merge', ariaLabel: 'Merge #618 into main' }))}
        isFirst
      />,
    );

    expect(screen.getByRole('button', { name: 'Merge #618 into main' }).textContent).toBe('Merge');
  });
});
