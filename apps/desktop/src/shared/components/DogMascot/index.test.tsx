// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { DogMascot } from '.';

afterEach(cleanup);

describe('DogMascot', () => {
  it('renders with the default size of 16', () => {
    const { container } = render(<DogMascot />);
    const el = container.firstElementChild as HTMLElement | null;
    expect(el).not.toBeNull();
    expect(el?.style.width).toBe('16px');
    expect(el?.style.height).toBe('16px');
  });

  it('honors a custom size', () => {
    const { container } = render(<DogMascot size={32} />);
    const el = container.firstElementChild as HTMLElement | null;
    expect(el?.style.width).toBe('32px');
  });

  it('is decorative (aria-hidden)', () => {
    const { container } = render(<DogMascot />);
    expect(container.querySelector('[aria-hidden]')).not.toBeNull();
  });
});
