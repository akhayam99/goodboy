// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Popover, PopoverBody, PopoverFooter } from '../components/Popover';

afterEach(cleanup);

describe('Popover', () => {
  it('keeps the footer action available when the body overflows', () => {
    render(
      <Popover>
        <PopoverBody>
          <div>{Array.from({ length: 40 }, (_, index) => `Row ${index}`)}</div>
        </PopoverBody>
        <PopoverFooter>
          <button type="button">Start</button>
        </PopoverFooter>
      </Popover>,
    );

    expect(screen.getByRole('button', { name: 'Start' })).toBeDefined();
  });
  it('carries no height bound of its own', () => {
    render(
      <Popover role="menu" ariaLabel="Bounded">
        <PopoverBody>Row</PopoverBody>
      </Popover>,
    );

    const popover = screen.getByRole('menu');
    expect(popover.style.maxHeight).toBe('');
    expect(popover.className).not.toContain('max-h-full');
  });

  it('scrolls plain content instead of clipping it', () => {
    render(
      <Popover role="menu" ariaLabel="Plain">
        Row
      </Popover>,
    );

    expect(screen.getByRole('menu').className).toContain('overflow-y-auto');
  });

  it('takes the positioned bound from its caller', () => {
    render(
      <Popover role="menu" ariaLabel="Fixed" style={{ maxHeight: 320 }}>
        <PopoverBody>Row</PopoverBody>
      </Popover>,
    );

    expect(screen.getByRole('menu').style.maxHeight).toBe('320px');
  });
  it('lets the body viewport fill the bounded popover instead of the content', () => {
    render(
      <Popover role="menu" ariaLabel="Scrolling">
        <PopoverBody>Row</PopoverBody>
      </Popover>,
    );

    const viewport = screen.getByRole('menu').querySelector('[class*="overflow-y-auto"]');
    expect(viewport?.className).toContain('flex-1');
    expect(viewport?.className).not.toContain('h-full');
  });
});
