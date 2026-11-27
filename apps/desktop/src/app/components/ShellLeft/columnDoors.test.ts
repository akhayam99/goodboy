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

  it('keeps the running stage glyph off the Board door', () => {
    const door = COLUMN_DOORS.find((entry) => entry.id === 'board');

    expect(door?.icon).toBe(CONCEPT_ICONS.board);
    expect(CONCEPT_ICONS.board).not.toBe(CONCEPT_ICONS.stageRunning);
  });

  it('lists the six places, no tool, no Monitoring and no Work door', () => {
    expect(COLUMN_DOORS.map((entry) => entry.label)).toEqual([
      'Board',
      'Tasks',
      'Workflows',
      'Chat',
      'Connections',
      'Impact',
    ]);
  });

  it('marks Impact as the one quiet reference door, last', () => {
    expect(
      COLUMN_DOORS.filter((entry) => entry.isReference === true).map((entry) => entry.id),
    ).toEqual(['impact']);
    expect(COLUMN_DOORS.at(-1)?.id).toBe('impact');
  });

  it('gives Connections the short rail word Connect and keeps every other word the label', () => {
    expect(COLUMN_DOORS.map((entry) => entry.word ?? entry.label)).toEqual([
      'Board',
      'Tasks',
      'Workflows',
      'Chat',
      'Connect',
      'Impact',
    ]);
  });

  it('draws Connections at full weight with the plug glyph, right after Chat', () => {
    const ids = COLUMN_DOORS.map((entry) => entry.id);
    const door = COLUMN_DOORS.find((entry) => entry.id === 'connections');

    expect(ids.indexOf('connections')).toBe(ids.indexOf('chat') + 1);
    expect(door?.icon).toBe(CONCEPT_ICONS.connections);
    expect(door?.isReference).toBeUndefined();
    expect(door?.shortcutId).toBeUndefined();
  });
});
