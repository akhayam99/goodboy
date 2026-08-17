// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Popover, PopoverBody, PopoverFooter } from '../components/Popover';

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
});
