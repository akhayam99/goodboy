// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShowToastParams } from '../../shared/components/Toast/toastContext';
import { keepRowFocus } from './keepRowFocus';

afterEach(() => {
  document.body.innerHTML = '';
});

type CardParams = {
  readonly id: string;
};

const cardOf = ({ id }: CardParams): HTMLElement => {
  const found = document.querySelector<HTMLElement>(`[data-select-id="${id}"]`);
  if (found === null) {
    throw new Error(`no card ${id}`);
  }
  return found;
};

const BOARD = `
  <main>
    <div role="list">
      <section>
        <article data-select-id="ledger" tabindex="0">Ledger export</article>
      </section>
      <section>
        <article data-select-id="payments" tabindex="0">Payments retry</article>
        <article data-select-id="notify" tabindex="0">Notify relay</article>
      </section>
    </div>
  </main>`;

describe('keepRowFocus', () => {
  it('moves the focus to the next card after an archive, across a lane', () => {
    document.body.innerHTML = BOARD;
    const rowFocus = keepRowFocus({ anchor: cardOf({ id: 'ledger' }), showToast: vi.fn() });

    cardOf({ id: 'ledger' }).remove();
    rowFocus.restore();

    expect(document.activeElement).toBe(cardOf({ id: 'payments' }));
  });

  it('keeps the focus on a card that only changed, such as a pin', () => {
    document.body.innerHTML = BOARD;
    const card = cardOf({ id: 'payments' });
    card.focus();
    const rowFocus = keepRowFocus({ anchor: card, showToast: vi.fn() });

    rowFocus.restore();

    expect(document.activeElement).toBe(card);
  });

  it('puts the focus back on the card that Undo brings back, after a slow Undo finishes', async () => {
    document.body.innerHTML = BOARD;
    const showToast = vi.fn<(params: ShowToastParams) => void>();
    const removed = cardOf({ id: 'payments' });
    const lane = removed.parentElement;
    const rowFocus = keepRowFocus({ anchor: removed, showToast });

    removed.remove();
    rowFocus.restore();
    expect(document.activeElement).toBe(cardOf({ id: 'notify' }));

    const finishUndo: Array<(isDone: boolean) => void> = [];
    const undo = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishUndo.push(resolve);
        }),
    );
    rowFocus.showToast({
      kind: 'info',
      message: 'Archived',
      action: { label: 'Undo', onClick: vi.fn(), undo },
    });
    const shown = showToast.mock.calls[0]?.[0];
    shown?.action?.onClick();

    expect(undo).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(cardOf({ id: 'notify' }));
    finishUndo[0]?.(true);
    await Promise.resolve();
    lane?.prepend(removed);

    await vi.waitFor(() => {
      expect(document.activeElement).toBe(cardOf({ id: 'payments' }));
    });
  });

  it('leaves the focus where it is when Undo did not bring the card back', async () => {
    document.body.innerHTML = BOARD;
    const showToast = vi.fn<(params: ShowToastParams) => void>();
    const removed = cardOf({ id: 'payments' });
    const lane = removed.parentElement;
    const rowFocus = keepRowFocus({ anchor: removed, showToast });
    removed.remove();
    rowFocus.restore();

    const undo = vi.fn(() => {
      lane?.prepend(removed);
      return Promise.resolve(false);
    });
    rowFocus.showToast({
      kind: 'info',
      message: 'Archived',
      action: { label: 'Undo', onClick: vi.fn(), undo },
    });
    showToast.mock.calls[0]?.[0]?.action?.onClick();
    await undo.mock.results[0]?.value;
    await Promise.resolve();

    expect(document.activeElement).toBe(cardOf({ id: 'notify' }));
  });

  it('passes a toast without Undo through unchanged', () => {
    document.body.innerHTML = BOARD;
    const showToast = vi.fn<(params: ShowToastParams) => void>();
    const rowFocus = keepRowFocus({ anchor: cardOf({ id: 'ledger' }), showToast });
    const toast: ShowToastParams = { kind: 'info', message: 'Copied' };

    rowFocus.showToast(toast);

    expect(showToast).toHaveBeenCalledWith(toast);
  });
});
