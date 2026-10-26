// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import { U27_IMAGE_LIGHTBOX_SCENES } from './image-lightbox';

afterEach(cleanup);

describe('image lightbox scene', () => {
  it('registers the scene for the layer probe', () => {
    expect(Object.keys(U27_IMAGE_LIGHTBOX_SCENES)).toEqual(['image-lightbox']);
    expect(MOCK_SCENES['image-lightbox']).toBe(U27_IMAGE_LIGHTBOX_SCENES['image-lightbox']);
  });

  it('opens the lightbox over a scrolling page', () => {
    const Scene = U27_IMAGE_LIGHTBOX_SCENES['image-lightbox'];
    render(<Scene />);
    screen.getByRole('img', { name: 'Harborline checkout preview' });
    screen.getByRole('button', { name: 'Close image preview' });
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(20);
  });

  it('closes on the close button and opens again from the page', () => {
    const Scene = U27_IMAGE_LIGHTBOX_SCENES['image-lightbox'];
    render(<Scene />);
    fireEvent.click(screen.getByRole('button', { name: 'Close image preview' }));
    expect(screen.queryByRole('img', { name: 'Harborline checkout preview' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }));
    screen.getByRole('img', { name: 'Harborline checkout preview' });
  });
});
