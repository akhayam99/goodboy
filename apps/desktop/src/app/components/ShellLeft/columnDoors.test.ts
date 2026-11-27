// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { COLUMN_DOORS, openColumnDoor } from './columnDoors';

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

  it('lists the seven places, no tool, no Monitoring and no Work door', () => {
    expect(COLUMN_DOORS.map((entry) => entry.label)).toEqual([
      'Board',
      'Tasks',
      'Workflows',
      'Chat',
      'Calendar',
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
      'Calendar',
      'Connect',
      'Impact',
    ]);
  });

  it('puts Calendar between Chat and Connections with its own glyph and no mark', () => {
    const ids = COLUMN_DOORS.map((entry) => entry.id);
    const door = COLUMN_DOORS.find((entry) => entry.id === 'calendar');

    expect(ids.indexOf('calendar')).toBe(ids.indexOf('chat') + 1);
    expect(ids.indexOf('connections')).toBe(ids.indexOf('calendar') + 1);
    expect(door?.icon).toBe(CONCEPT_ICONS.calendar);
    expect(door?.isReference).toBeUndefined();
  });

  it('opens the Calendar door through its own action', () => {
    const actions = {
      openBoard: vi.fn(),
      openInbox: vi.fn(),
      openChat: vi.fn(),
      openWorkflows: vi.fn(),
      openNewChat: vi.fn(),
      openCalendar: vi.fn(),
      openConnections: vi.fn(),
      openMonitoring: vi.fn(),
      openImpact: vi.fn(),
      openSettings: vi.fn(),
      openChangelog: vi.fn(),
      openGuide: vi.fn(),
    };
    openColumnDoor({ id: 'calendar', actions });

    expect(actions.openCalendar).toHaveBeenCalledOnce();
    expect(actions.openConnections).not.toHaveBeenCalled();
  });

  it('draws Connections at full weight with the plug glyph, right after Calendar', () => {
    const ids = COLUMN_DOORS.map((entry) => entry.id);
    const door = COLUMN_DOORS.find((entry) => entry.id === 'connections');

    expect(ids.indexOf('connections')).toBe(ids.indexOf('calendar') + 1);
    expect(door?.icon).toBe(CONCEPT_ICONS.connections);
    expect(door?.isReference).toBeUndefined();
    expect(door?.shortcutId).toBeUndefined();
  });
});
