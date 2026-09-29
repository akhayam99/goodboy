// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { registerEscapeLayer } from '@goodboy/ui';
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

  it('closes on Escape, and leaves it to a layer opened above it', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const closeAbove = vi.fn();
    render(<ImageLightbox src="img.png" alt="x" onClose={onClose} />);
    const offAbove = registerEscapeLayer(closeAbove);

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(closeAbove).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();

    offAbove();
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onClose).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('frees the page scroll again once it unmounts', () => {
    const view = render(<ImageLightbox src="img.png" alt="x" onClose={vi.fn()} />);
    expect(document.body.style.overflow).toBe('hidden');

    view.unmount();

    expect(document.body.style.overflow).toBe('');
  });
});
