// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import { U30_LIMIT_CHIP_SCENES } from './limit-chip';

afterEach(cleanup);

describe('limit chip scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(U30_LIMIT_CHIP_SCENES)).toEqual(['u30-limit-chip']);
    expect(MOCK_SCENES['u30-limit-chip']).toBe(U30_LIMIT_CHIP_SCENES['u30-limit-chip']);
  });

  it('shows the default tag, a typed amount and one open popover with the presets', () => {
    const Scene = U30_LIMIT_CHIP_SCENES['u30-limit-chip'];
    render(<Scene />);

    screen.getByRole('button', { name: 'Limit $5.00 · default' });
    expect(screen.getAllByRole('button', { name: 'Limit $8.00' })).toHaveLength(2);
    const dialog = screen.getByRole('dialog', { name: 'Limit for this run' });
    within(dialog).getByRole('group', { name: 'Amounts' });
  });
});
