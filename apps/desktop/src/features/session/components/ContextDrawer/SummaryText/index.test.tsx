// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { SummaryText } from '.';

afterEach(cleanup);

describe('SummaryText', () => {
  it('keeps bold around a code span and draws the code as a summary code', () => {
    const { container } = render(<SummaryText text="**retry `notify-relay` first** then ship" />);

    const strong = container.querySelector('strong');
    expect(strong?.querySelector('code')?.textContent).toBe('notify-relay');
    expect(strong?.textContent).toBe('retry notify-relay first');
    expect(container.textContent).not.toContain('*');
    expect(container.textContent).not.toContain('`');
  });

  it('shows a link whose label holds code as its text, with the code inside', () => {
    const { container } = render(
      <SummaryText text="see [the `ledger-core` notes](https://acme.test/notes) today" />,
    );

    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('code')?.textContent).toBe('ledger-core');
    expect(container.textContent).toBe('see the ledger-core notes today');
  });

  it('shortens a long path inside the code and keeps the full one for readers', () => {
    const path = 'packages/payments-api/src/delivery/retry/backoffPolicy.ts';
    const { container } = render(<SummaryText text={`moved \`${path}\``} />);

    const code = container.querySelector('code[data-short-path]');
    expect(code).not.toBeNull();
    expect(code?.querySelector('.sr-only')?.textContent).toBe(path);
  });
});
