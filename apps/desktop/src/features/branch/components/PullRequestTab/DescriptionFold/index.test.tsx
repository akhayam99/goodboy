// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DescriptionFold } from './index';

afterEach(cleanup);

describe('DescriptionFold', () => {
  it('opens the fold when focus lands on a link below the cutoff', async () => {
    const tall = vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockReturnValue(400);
    const short = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(120);
    try {
      const user = userEvent.setup();
      const { container } = render(
        <DescriptionFold>
          <p>Retried webhooks posted a second credit.</p>
          <a href="https://example.com/ledger-core/issues/412">Closes ledger-core 412</a>
        </DescriptionFold>,
      );
      await screen.findByRole('button', { name: 'Show the full description' });
      expect(container.querySelector('[data-folded="true"]')).not.toBeNull();

      await user.tab();

      expect(document.activeElement).toBe(screen.getByRole('link'));
      expect(container.querySelector('[data-folded]')).toBeNull();
      expect(screen.getByRole('button', { name: 'Show less' }).getAttribute('aria-expanded')).toBe(
        'true',
      );
    } finally {
      tall.mockRestore();
      short.mockRestore();
    }
  });
});
