// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { registerEscapeLayer } from '@goodboy/ui';
import { ImageLightbox } from './index';

afterEach(cleanup);

describe('ImageLightbox', () => {
  it('renders the dialog named after the image, with the image', () => {
    render(<ImageLightbox src="img.png" alt="screenshot" onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'screenshot', hidden: true })).toBeDefined();
    expect(screen.getByAltText('screenshot')).toBeDefined();
  });

  it('closes when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<ImageLightbox src="img.png" alt="x" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close image preview/i, hidden: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not close when the image itself is clicked', () => {
    const onClose = vi.fn();
    render(<ImageLightbox src="img.png" alt="x" onClose={onClose} />);
    fireEvent.click(screen.getByAltText('x'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the empty area around the image is clicked', () => {
    const onClose = vi.fn();
    render(<ImageLightbox src="img.png" alt="x" onClose={onClose} />);
    const area = screen.getByAltText('x').parentElement;
    if (area === null) {
      throw new Error('image has no parent');
    }
    fireEvent.click(area);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on Escape, and leaves it to a layer opened above it', () => {
    const onClose = vi.fn();
    const closeAbove = vi.fn();
    render(<ImageLightbox src="img.png" alt="x" onClose={onClose} />);
    const offAbove = registerEscapeLayer(closeAbove);

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(closeAbove).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();

    offAbove();
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('opens as a modal dialog', () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    render(<ImageLightbox src="img.png" alt="Harborline ledger export" onClose={vi.fn()} />);
    expect(showModal).toHaveBeenCalledOnce();
    showModal.mockRestore();
  });

  it('puts focus on Close when it opens and gives it back to the opener', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const view = render(
      <ImageLightbox src="img.png" alt="Harborline ledger export" onClose={vi.fn()} />,
    );
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /close image preview/i, hidden: true }),
    );

    view.unmount();

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('frees the page scroll again once it unmounts', () => {
    const view = render(<ImageLightbox src="img.png" alt="x" onClose={vi.fn()} />);
    expect(document.body.style.overflow).toBe('hidden');

    view.unmount();

    expect(document.body.style.overflow).toBe('');
  });

  it('shows an image through an img element and no frame', () => {
    const { baseElement } = render(<ImageLightbox src="img.png" alt="x" onClose={vi.fn()} />);
    expect(baseElement.querySelector('img')?.getAttribute('src')).toBe('img.png');
    expect(baseElement.querySelector('iframe')).toBeNull();
  });

  it('shows a pdf through an iframe with the given source and an empty sandbox', () => {
    const { baseElement } = render(
      <ImageLightbox src="about:blank" alt="Q3 report" media="pdf" onClose={vi.fn()} />,
    );
    const frame = baseElement.querySelector('iframe');
    expect(frame?.getAttribute('src')).toBe('about:blank');
    expect(frame?.getAttribute('title')).toBe('Q3 report');
    expect(frame?.getAttribute('sandbox')).toBe('');
    expect(baseElement.querySelector('img')).toBeNull();
  });
});
