// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CopyButton } from './index';

afterEach(cleanup);

describe('CopyButton', () => {
  it('copies the value and confirms success without changing its accessible name', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const { container } = render(<CopyButton value="session summary" label="copy summary" />);
    fireEvent.click(screen.getByRole('button', { name: 'copy summary' }));

    expect(writeText).toHaveBeenCalledWith('session summary');
    await waitFor(() => expect(container.querySelector('.lucide-check')).not.toBeNull());
    expect(screen.getByRole('button', { name: 'copy summary' })).toBeDefined();
  });
});
