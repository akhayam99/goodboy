// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { DogMascot } from '.';

afterEach(cleanup);

describe('DogMascot', () => {
  it('renders an svg with the default size of 16', () => {
    const { container } = render(<DogMascot />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('16');
    expect(svg?.getAttribute('height')).toBe('16');
  });

  it('honors a custom size', () => {
    const { container } = render(<DogMascot size={32} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('32');
  });

  it('is decorative (aria-hidden)', () => {
    const { container } = render(<DogMascot />);
    expect(container.querySelector('svg[aria-hidden]')).not.toBeNull();
  });
});
