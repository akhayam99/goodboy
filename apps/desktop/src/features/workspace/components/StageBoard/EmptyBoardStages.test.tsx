// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { EmptyBoardStages } from './EmptyBoardStages';

afterEach(cleanup);

describe('EmptyBoardStages', () => {
  it('names the five board stages in the order a session meets them, each at zero', () => {
    render(<EmptyBoardStages />);

    const stages = within(screen.getByRole('list', { name: 'Board stages' })).getAllByRole(
      'listitem',
    );

    expect(stages.map((stage) => stage.textContent)).toEqual([
      'Needs you0',
      'Running0',
      'In review0',
      'Building0',
      'Done0',
    ]);
  });
});
