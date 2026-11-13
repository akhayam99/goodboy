// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { openCountWord } from '../../../openCountWord';
import { TasksCountChip } from '.';

afterEach(cleanup);

const record = ({ key, state }: { readonly key: string; readonly state: 'open' | 'done' }) => ({
  key,
  state,
});

describe('TasksCountChip', () => {
  it('reads the same count function the list header used to print', () => {
    const records = [
      record({ key: 'a', state: 'open' }),
      record({ key: 'b', state: 'open' }),
      record({ key: 'c', state: 'done' }),
    ];
    render(<TasksCountChip records={records} />);

    expect(screen.getByTestId('tasks-count').textContent).toBe(openCountWord({ records }));
    expect(screen.getByTestId('tasks-count').textContent).toBe('2 open');
  });

  it('adds the new count and thousands separators the same way', () => {
    const records = Array.from({ length: 1024 }, (_, index) =>
      record({ key: `k${index}`, state: 'open' }),
    );
    const newKeys = new Set(['k1', 'k2']);
    render(<TasksCountChip records={records} newKeys={newKeys} />);

    expect(screen.getByTestId('tasks-count').textContent).toBe(openCountWord({ records, newKeys }));
    expect(screen.getByTestId('tasks-count').textContent).toBe('1,024 open, 2 new');
  });
});
