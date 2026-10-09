// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import { U23_SCALES_SCENES } from './scales';

afterEach(cleanup);

describe('the scale scenes', () => {
  it('registers both scene ids', () => {
    expect(MOCK_SCENES['design-scale-ladders']).toBe(U23_SCALES_SCENES['design-scale-ladders']);
    expect(MOCK_SCENES['design-controls-scale']).toBe(U23_SCALES_SCENES['design-controls-scale']);
  });

  it('draws the four icon rungs, the four text roles, the six row heights and the six gaps by token name', () => {
    const Scene = U23_SCALES_SCENES['design-scale-ladders'];
    render(<Scene />);

    const icons = within(screen.getByText('Icon ladder').closest('section') as HTMLElement);
    ['mark', 'row', 'control', 'hero'].forEach((rung) => {
      icons.getByText(`ICON_SIZE.${rung}`);
    });
    ['label', 'secondary', 'hint', 'disabled'].forEach((role) => {
      screen.getByText(`TEXT_ROLE.${role}`);
    });
    const rows = within(screen.getByText('Row scale').closest('section') as HTMLElement);
    ['24px', '28px', '32px', '36px', '40px', '48px'].forEach((height) => {
      rows.getByText(height);
    });
    ['gap-1', 'gap-2', 'gap-3', 'gap-4', 'gap-6', 'gap-8'].forEach((token) => {
      screen.getByText(token);
    });
  });

  it('sets a Button, an icon button, a Chip and a row of every ladder size side by side', () => {
    const Scene = U23_SCALES_SCENES['design-controls-scale'];
    render(<Scene />);

    ['xs', 'sm', 'md'].forEach((size) => {
      screen.getByRole('button', { name: `Button ${size}` });
    });
    ['3xs', 'xs', 'sm', 'md', 'control'].forEach((size) => {
      screen.getByText(`Chip ${size}`);
    });
    expect(screen.getAllByText(/^Row \d+px, Northwind release$/)).toHaveLength(6);
  });
});
