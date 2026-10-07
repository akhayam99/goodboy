// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LineMark } from '../components/LineMark';

afterEach(cleanup);

describe('LineMark', () => {
  it('is one text line tall and centres its mark on that line', () => {
    render(
      <LineMark>
        <svg data-testid="glyph" />
      </LineMark>,
    );

    const slot = screen.getByTestId('glyph').parentElement;
    expect(slot?.getAttribute('data-slot')).toBe('line-mark');
    const classes = slot?.className.split(' ') ?? [];
    expect(classes).toEqual(expect.arrayContaining(['flex', 'h-lh', 'items-center', 'shrink-0']));
  });

  it('keeps a caller class beside the line height', () => {
    render(
      <LineMark className="text-faint-foreground">
        <svg data-testid="glyph" />
      </LineMark>,
    );

    const classes = screen.getByTestId('glyph').parentElement?.className.split(' ') ?? [];
    expect(classes).toEqual(expect.arrayContaining(['h-lh', 'text-faint-foreground']));
  });
});
