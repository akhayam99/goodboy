// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { COLUMN_DOORS } from './columnDoors';

describe('the column doors', () => {
  it('names the tracker door Tasks and keeps its id', () => {
    const door = COLUMN_DOORS.find((entry) => entry.id === 'inbox');

    expect(door?.label).toBe('Tasks');
  });

  it('draws every door with a glyph from the concept registry', () => {
    const registry = new Set<unknown>(Object.values(CONCEPT_ICONS));

    expect(COLUMN_DOORS.filter((entry) => !registry.has(entry.icon))).toEqual([]);
  });

  it('keeps the running stage glyph off the Sessions door', () => {
    const door = COLUMN_DOORS.find((entry) => entry.id === 'board');

    expect(door?.icon).toBe(CONCEPT_ICONS.sessions);
    expect(CONCEPT_ICONS.sessions).not.toBe(CONCEPT_ICONS.stageRunning);
  });

  it('lists Sessions, Tasks, then Workflows, Chat, Terminal, then Impact and Monitoring', () => {
    expect(COLUMN_DOORS.map((entry) => entry.label)).toEqual([
      'Sessions',
      'Tasks',
      'Workflows',
      'Chat',
      'Terminal',
      'Impact',
      'Monitoring',
    ]);
  });

  it('marks only Impact and Monitoring as reference doors, below the separator', () => {
    expect(
      COLUMN_DOORS.filter((entry) => entry.isReference === true).map((entry) => entry.id),
    ).toEqual(['impact', 'monitoring']);
    expect(COLUMN_DOORS.slice(-2).every((entry) => entry.isReference === true)).toBe(true);
  });
});
