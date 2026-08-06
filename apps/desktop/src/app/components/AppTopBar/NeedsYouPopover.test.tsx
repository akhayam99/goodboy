// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../../store', () => ({
  useAppStore: <T,>(
    selector: (s: { setCurrentSession: () => Promise<void>; setActiveLens: () => void }) => T,
  ) => selector({ setCurrentSession: async () => undefined, setActiveLens: () => {} }),
}));

import { NeedsYouPopover } from './NeedsYouPopover';

afterEach(cleanup);

describe('NeedsYouPopover', () => {
  it('opens its popover on the named z-popover layer, above a full-page studio', async () => {
    render(<NeedsYouPopover sessions={[]} count={1} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /needs you/i }));
    });

    expect(document.body.querySelector('.z-popover-backdrop')).not.toBeNull();
    expect(document.body.querySelector('.z-popover')).not.toBeNull();
  });
});
