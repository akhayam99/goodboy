// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { COLUMN_DOORS } from './columnDoors';

describe('the column doors', () => {
  it('names the tracker door Tasks and keeps its id', () => {
    const door = COLUMN_DOORS.find((entry) => entry.id === 'inbox');

    expect(door?.label).toBe('Tasks');
  });

  it('lists Board, Tasks, Chat and Workflows in that order', () => {
    expect(COLUMN_DOORS.map((entry) => entry.label)).toEqual([
      'Board',
      'Tasks',
      'Chat',
      'Workflows',
    ]);
  });
});
