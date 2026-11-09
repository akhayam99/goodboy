// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CONCEPT_ICONS } from '../components/conceptIcons';
import { SHORTCUTS } from '../keyboard/registry';
import { NAMES } from '../utils/names';
import { COLUMN_DOORS } from '../../app/components/SideColumn/columnDoors';
import { DESTINATIONS } from './destinations';
import { destinationOf } from './destinationOf';

describe('the destination list', () => {
  it('names every destination once, in the order every channel shows', () => {
    expect(DESTINATIONS.map((destination) => destination.label)).toEqual([
      'Board',
      'Tasks',
      'Workflows',
      'Chat',
      'Impact',
      'Terminal',
      'Browser',
      'Monitoring',
      'Notifications',
    ]);
  });

  it('gives each destination its own glyph from the concept registry', () => {
    const registry = new Set<unknown>(Object.values(CONCEPT_ICONS));
    const icons = DESTINATIONS.map((destination) => destination.icon);

    expect(icons.filter((icon) => !registry.has(icon))).toEqual([]);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('reads each name from the names table', () => {
    expect(destinationOf({ id: 'board' }).label).toBe(NAMES.board);
    expect(destinationOf({ id: 'inbox' }).label).toBe(NAMES.tasks);
    expect(destinationOf({ id: 'notifications' }).label).toBe(NAMES.notifications);
  });

  it('keeps the former name Sessions searchable on Board', () => {
    expect(destinationOf({ id: 'board' }).aliases).toContain('Sessions');
  });

  it('shows the same word in the shortcut sheet as in the list', () => {
    const keyed = DESTINATIONS.filter((destination) => destination.shortcutId !== undefined);

    expect(keyed.map((destination) => destination.id)).toEqual(['board', 'terminal']);
    keyed.forEach((destination) => {
      const id = destination.shortcutId;
      expect(id === undefined ? null : SHORTCUTS[id].label).toBe(destination.label);
    });
  });

  it('lists the keyed destinations in the sheet in the same order as the list', () => {
    const navigate = Object.keys(SHORTCUTS).filter(
      (id) => id === 'session.board' || id === 'terminal.studio',
    );

    expect(navigate).toEqual(['session.board', 'terminal.studio']);
  });

  it('draws the column doors from the list, in its order', () => {
    const inColumn = DESTINATIONS.filter((destination) => destination.home !== 'topBar');

    expect(COLUMN_DOORS.map((door) => door.id)).toEqual(
      inColumn.map((destination) => destination.id),
    );
    expect(COLUMN_DOORS.map((door) => door.label)).toEqual(
      inColumn.map((destination) => destination.label),
    );
    expect(COLUMN_DOORS.map((door) => door.icon)).toEqual(
      inColumn.map((destination) => destination.icon),
    );
  });
});
