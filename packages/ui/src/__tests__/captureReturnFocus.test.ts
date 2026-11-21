// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { captureReturnFocus } from '../confirmReturnFocus';

afterEach(() => {
  document.body.innerHTML = '';
});

type ButtonParams = {
  readonly name: string;
};

const buttonOf = ({ name }: ButtonParams): HTMLElement => {
  const found = document.querySelector<HTMLElement>(`button[aria-label="${name}"]`);
  if (found === null) {
    throw new Error(`no ${name}`);
  }
  return found;
};

const LIST = `
  <div role="list">
    <section>
      <div data-row><button aria-label="ledger-core"></button></div>
      <div data-row><button aria-label="payments-api"></button></div>
    </section>
    <section>
      <div data-row><button aria-label="notify-relay"></button></div>
    </section>
  </div>`;

describe('captureReturnFocus', () => {
  it('moves focus to the next row, across a group, once the row is gone', () => {
    document.body.innerHTML = LIST;
    const anchor = buttonOf({ name: 'payments-api' });
    const restore = captureReturnFocus({ anchor, rowSelector: '[data-row]' });

    anchor.closest('[data-row]')?.remove();
    restore();

    expect(document.activeElement).toBe(buttonOf({ name: 'notify-relay' }));
  });

  it('falls back to the row before the last row of the list', () => {
    document.body.innerHTML = LIST;
    const anchor = buttonOf({ name: 'notify-relay' });
    const restore = captureReturnFocus({ anchor, rowSelector: '[data-row]' });

    anchor.closest('section')?.remove();
    restore();

    expect(document.activeElement).toBe(buttonOf({ name: 'payments-api' }));
  });

  it('keeps the focus inside its own landmark when the sole row of a list goes', () => {
    document.body.innerHTML = `
      <nav>
        <div role="list">
          <div data-row><button aria-label="ledger-core"></button></div>
          <div data-row><button aria-label="payments-api"></button></div>
        </div>
      </nav>
      <main>
        <ul id="branches">
          <li data-row><button aria-label="notify-relay"></button></li>
        </ul>
      </main>`;
    const anchor = buttonOf({ name: 'notify-relay' });
    const restore = captureReturnFocus({ anchor, rowSelector: '[data-row]' });

    anchor.closest('[data-row]')?.remove();
    restore();

    expect(document.activeElement).toBe(document.getElementById('branches'));
    expect(document.querySelector('nav')?.contains(document.activeElement)).toBe(false);
  });

  it('finds the next row again by its key when the list drew it anew', () => {
    document.body.innerHTML = `
      <div role="list">
        <div data-row="ledger-core"><button aria-label="ledger-core"></button></div>
        <div data-row="payments-api"><button aria-label="payments-api"></button></div>
      </div>`;
    const anchor = buttonOf({ name: 'ledger-core' });
    const restore = captureReturnFocus({
      anchor,
      rowSelector: '[data-row]',
      keyOf: ({ row }) => row.getAttribute('data-row'),
    });

    document.body.innerHTML = `
      <div role="list">
        <div data-row="payments-api"><button aria-label="payments-api"></button></div>
      </div>`;
    restore();

    expect(document.activeElement).toBe(buttonOf({ name: 'payments-api' }));
  });

  it('leaves the focus alone when the row is still there', () => {
    document.body.innerHTML = LIST;
    const anchor = buttonOf({ name: 'ledger-core' });
    anchor.focus();
    const restore = captureReturnFocus({ anchor, rowSelector: '[data-row]' });

    restore();

    expect(document.activeElement).toBe(anchor);
  });
});
