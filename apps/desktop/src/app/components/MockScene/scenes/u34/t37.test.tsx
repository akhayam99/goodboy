// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import { U34_T37_SCENES } from './t37';

afterEach(cleanup);

describe('the u34 pr page loading scene', () => {
  it('registers for the capture and shows the activity skeleton', () => {
    expect(MOCK_SCENES['u34-t37-pr-page-loading']).toBe(U34_T37_SCENES['u34-t37-pr-page-loading']);
    const Scene = U34_T37_SCENES['u34-t37-pr-page-loading'];
    render(<Scene />);

    screen.getByRole('status', { name: 'Reading the activity' });
    screen.getByRole('region', { name: 'Merge status' });
  });

  it('draws shapes, not claims, until the data is known: a pending merge box and four rows', () => {
    const Scene = U34_T37_SCENES['u34-t37-pr-page-loading'];
    const { container } = render(<Scene />);

    const box = container.querySelector('[data-merge-box]');
    expect(box?.getAttribute('aria-busy')).toBe('true');
    expect(box?.hasAttribute('data-pending')).toBe(true);
    expect(box?.textContent).toBe('Reading merge status');
    const rows = screen.getByRole('status', { name: 'Reading the activity' }).children;
    expect(rows).toHaveLength(4);
  });
});
