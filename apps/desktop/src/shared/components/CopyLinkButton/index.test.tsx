// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CopyLinkButton } from './index';

afterEach(cleanup);

describe('CopyLinkButton', () => {
  it('copies the url and confirms it', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<CopyLinkButton url="https://linear.app/GB-12" label="GB-12" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy GB-12 link' }));

    expect(writeText).toHaveBeenCalledWith('https://linear.app/GB-12');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Copy GB-12 link' }).className).toContain(
        'text-success',
      ),
    );
  });

  it('reports a failed copy instead of pretending it worked', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn(async () => {
          throw new Error('denied');
        }),
      },
    });

    render(<CopyLinkButton url="https://linear.app/GB-12" label="GB-12" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy GB-12 link' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Copy GB-12 link' }).getAttribute('title')).toBe(
        'copy failed',
      ),
    );
  });
});
