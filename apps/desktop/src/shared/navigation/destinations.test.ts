// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CONCEPT_ICONS } from '../components/conceptIcons';
import { SHORTCUTS } from '../keyboard/registry';
import { NAMES } from '../utils/names';
import { COLUMN_DOORS } from '../../app/components/SideColumn/columnDoors';
import { LENS_ICON } from '../../features/session/lens-labels';
import { shortcutRows } from '../../features/settings/components/SettingsStudio/shortcutRows';
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
      'Settings',
      'Guide',
      "What's new",
    ]);
  });

  it('gives each destination its own glyph from the concept registry', () => {
    const registry = new Set<unknown>(Object.values(CONCEPT_ICONS));
    const icons = DESTINATIONS.map((destination) => destination.icon);

    expect(icons.filter((icon) => !registry.has(icon))).toEqual([]);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('keeps the session pages Runs and Artifacts off the glyphs of other destinations', () => {
    const doorIcons = new Set<unknown>(DESTINATIONS.map((destination) => destination.icon));

    expect(LENS_ICON.workflows).toBe(CONCEPT_ICONS.runs);
    expect(LENS_ICON.plans).toBe(CONCEPT_ICONS.artifacts);
    expect(doorIcons.has(LENS_ICON.workflows)).toBe(false);
    expect(doorIcons.has(LENS_ICON.plans)).toBe(false);
    expect(LENS_ICON.workflows).not.toBe(destinationOf({ id: 'workflows' }).icon);
  });

  it('reads each name from the names table', () => {
    expect(destinationOf({ id: 'board' }).label).toBe(NAMES.board);
    expect(destinationOf({ id: 'inbox' }).label).toBe(NAMES.tasks);
    expect(destinationOf({ id: 'notifications' }).label).toBe(NAMES.notifications);
    expect(destinationOf({ id: 'settings' }).label).toBe(NAMES.settings);
    expect(destinationOf({ id: 'guide' }).label).toBe(NAMES.guide);
    expect(destinationOf({ id: 'whatsNew' }).label).toBe(NAMES.whatsNew);
  });

  it('keeps the former name Sessions searchable on Board', () => {
    expect(destinationOf({ id: 'board' }).aliases).toContain('Sessions');
  });

  it('keeps the former name Changelog searchable on What is new', () => {
    expect(destinationOf({ id: 'whatsNew' }).aliases).toContain('Changelog');
  });

  it('puts Settings, Guide and What is new at the foot, in the app scope', () => {
    const foot = DESTINATIONS.filter((destination) => destination.home === 'foot');

    expect(foot.map((destination) => destination.id)).toEqual(['settings', 'guide', 'whatsNew']);
    expect(foot.map((destination) => destination.scope)).toEqual(['app', 'app', 'app']);
  });

  it('puts every workspace page in the workspace scope', () => {
    const app = DESTINATIONS.filter((destination) => destination.home !== 'foot');

    expect(app.map((destination) => destination.scope)).toEqual(app.map(() => 'workspace'));
  });

  it('shows the same word in the shortcut sheet as in the list', () => {
    const keyed = DESTINATIONS.filter((destination) => destination.shortcutId !== undefined);

    expect(keyed.map((destination) => destination.id)).toEqual(['board', 'terminal', 'settings']);
    keyed.forEach((destination) => {
      const id = destination.shortcutId;
      expect(id === undefined ? null : SHORTCUTS[id].label).toBe(destination.label);
    });
  });

  it('lists the keyed destinations of the Navigate group in the order of the list', () => {
    const keyed = DESTINATIONS.flatMap((destination) =>
      destination.shortcutId === undefined ? [] : [destination.shortcutId],
    );
    const listed = shortcutRows({ group: 'navigate' })
      .map((row) => row.first)
      .filter((id) => keyed.includes(id));

    expect(listed).toEqual(keyed.filter((id) => SHORTCUTS[id].group === 'navigate'));
  });

  it('draws the column doors from the list, in its order', () => {
    const inColumn = DESTINATIONS.filter(
      (destination) => destination.home === 'column' || destination.home === 'tile',
    );

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
