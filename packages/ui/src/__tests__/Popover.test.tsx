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
  it('defers its own height bound to the dropdown variable', () => {
    render(
      <Popover role="menu" ariaLabel="Bounded">
        <PopoverBody>Row</PopoverBody>
      </Popover>,
    );

    const popover = screen.getByRole('menu');
    expect(popover.style.maxHeight).toBe('var(--dropdown-max-height, 100%)');
    expect(popover.className).not.toContain('max-h-full');
  });

  it('lets a positioned caller override the bound', () => {
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
