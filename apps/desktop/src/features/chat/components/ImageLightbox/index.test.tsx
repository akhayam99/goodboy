// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ImageLightbox } from './index';

afterEach(cleanup);

describe('ImageLightbox', () => {
  it('renders the preview dialog with the image', () => {
    render(<ImageLightbox src="img.png" alt="screenshot" onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: /preview screenshot/i })).toBeDefined();
    expect(screen.getByAltText('screenshot')).toBeDefined();
  });

  it('starts the close transition when the close button is clicked', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<ImageLightbox src="img.png" alt="x" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close image preview/i }));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onClose).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('does not close when the image itself is clicked', () => {
    const onClose = vi.fn();
    render(<ImageLightbox src="img.png" alt="x" onClose={onClose} />);
    fireEvent.click(screen.getByAltText('x'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
