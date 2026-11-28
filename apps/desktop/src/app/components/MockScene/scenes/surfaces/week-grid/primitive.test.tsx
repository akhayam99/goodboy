// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MOCK_SCENES } from '../../..';
import { WEEK_GRID_PRIMITIVE_SCENES } from './primitive';

afterEach(cleanup);

describe('the week grid scenes', () => {
  it('registers the dark and the light scene', () => {
    expect(Object.keys(WEEK_GRID_PRIMITIVE_SCENES).sort()).toEqual([
      'week-grid-dark',
      'week-grid-light',
    ]);
    expect(MOCK_SCENES['week-grid-dark']).toBe(WEEK_GRID_PRIMITIVE_SCENES['week-grid-dark']);
  });

  it.each(['week-grid-dark', 'week-grid-light'] as const)(
    '%s draws five days with today marked and the busy blocks quiet',
    async (id) => {
      const Scene = WEEK_GRID_PRIMITIVE_SCENES[id];
      render(<Scene />);

      const week = await screen.findByRole('group', { name: 'Week' });
      expect(within(week).getAllByRole('region')).toHaveLength(5);
      expect(within(week).getByRole('region', { name: 'Thu' }).hasAttribute('data-today')).toBe(
        true,
      );
      expect(within(week).getAllByRole('button', { name: /Busy/ })).toHaveLength(2);
    },
  );
});
