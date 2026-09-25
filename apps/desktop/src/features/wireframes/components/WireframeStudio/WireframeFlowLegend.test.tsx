// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { WireframeFlowLegend } from './WireframeFlowLegend';

afterEach(cleanup);

describe('WireframeFlowLegend', () => {
  it('names every edge kind with a glyph and a word, never a colour alone', () => {
    render(<WireframeFlowLegend />);
    const legend = screen.getByRole('list', { name: 'Flow legend' });
    expect([...legend.querySelectorAll('li')].map((item) => item.textContent)).toEqual([
      '→next',
      '↩back',
      '↻same screen',
    ]);
    expect(legend.innerHTML).not.toMatch(/text-(?:info|warning|merged)/);
  });
});
