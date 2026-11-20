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

  it('leaves the focus alone when the row is still there', () => {
    document.body.innerHTML = LIST;
    const anchor = buttonOf({ name: 'ledger-core' });
    anchor.focus();
    const restore = captureReturnFocus({ anchor, rowSelector: '[data-row]' });

    restore();

    expect(document.activeElement).toBe(anchor);
  });
});
