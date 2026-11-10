// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { COLUMN_DOORS, COLUMN_ROW_DOORS, COLUMN_TOOL_DOORS } from './columnDoors';

describe('the column doors', () => {
  it('names the tracker door Tasks and keeps its id', () => {
    const door = COLUMN_DOORS.find((entry) => entry.id === 'inbox');

    expect(door?.label).toBe('Tasks');
  });

  it('draws every door with a glyph from the concept registry', () => {
    const registry = new Set<unknown>(Object.values(CONCEPT_ICONS));

    expect(COLUMN_DOORS.filter((entry) => !registry.has(entry.icon))).toEqual([]);
  });

  it('keeps the running stage glyph off the Board door', () => {
    const door = COLUMN_DOORS.find((entry) => entry.id === 'board');

    expect(door?.icon).toBe(CONCEPT_ICONS.sessions);
    expect(CONCEPT_ICONS.sessions).not.toBe(CONCEPT_ICONS.stageRunning);
  });

  it('lists Board, Tasks, Workflows, Chat and Impact, then the Terminal, Browser and Monitoring tools', () => {
    expect(COLUMN_DOORS.map((entry) => entry.label)).toEqual([
      'Board',
      'Tasks',
      'Workflows',
      'Chat',
      'Impact',
      'Terminal',
      'Browser',
      'Monitoring',
    ]);
  });

  it('marks only Impact as a reference door', () => {
    expect(
      COLUMN_DOORS.filter((entry) => entry.isReference === true).map((entry) => entry.id),
    ).toEqual(['impact']);
  });

  it('splits the doors into rows and tools, keeping the rail order', () => {
    expect(COLUMN_ROW_DOORS.map((entry) => entry.id)).toEqual([
      'board',
      'inbox',
      'workflows',
      'chat',
      'impact',
    ]);
    expect(COLUMN_TOOL_DOORS.map((entry) => entry.id)).toEqual([
      'terminal',
      'browser',
      'monitoring',
    ]);
    expect([...COLUMN_ROW_DOORS, ...COLUMN_TOOL_DOORS]).toEqual(COLUMN_DOORS);
  });
});
