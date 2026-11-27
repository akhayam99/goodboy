import { describe, expect, it } from 'vitest';
import { DEFAULT_HOME_ENTRIES } from './defaultHomeLayout';
import { hideHomeWidget } from './hideHomeWidget';
import { neighbourOf } from './neighbourOf';
import { parseHomeLayout } from './parseHomeLayout';
import { serializeHomeLayout } from './serializeHomeLayout';
import { showHomeWidget } from './showHomeWidget';
import { trayWidgetsOf } from './trayWidgetsOf';

const raw = (widgets: ReadonlyArray<unknown>, v = 1): string => JSON.stringify({ v, widgets });

describe('parseHomeLayout', () => {
  it('reads nothing as no layout', () => {
    expect(parseHomeLayout({ raw: null })).toBeNull();
    expect(parseHomeLayout({ raw: 'not json' })).toBeNull();
    expect(parseHomeLayout({ raw: raw([], 2) })).toBeNull();
    expect(parseHomeLayout({ raw: '{"v":1}' })).toBeNull();
  });

  it('drops an unknown id, a repeated id and keeps the order', () => {
    const entries = parseHomeLayout({
      raw: raw([
        { id: 'spend', size: 'S' },
        { id: 'calendar', size: 'M' },
        { id: 'needsYou', size: 'L' },
        { id: 'spend', size: 'M' },
        'spend',
      ]),
    });

    expect(entries).toEqual([
      { id: 'spend', size: 'S' },
      { id: 'needsYou', size: 'L' },
    ]);
  });

  it('falls back to the default size for an unknown size or one the widget lacks', () => {
    const entries = parseHomeLayout({
      raw: raw([
        { id: 'spend', size: 'XL' },
        { id: 'longRunning', size: 'L' },
        { id: 'tasksInbox' },
      ]),
    });

    expect(entries).toEqual([
      { id: 'spend', size: 'M' },
      { id: 'longRunning', size: 'M' },
      { id: 'tasksInbox', size: 'M' },
    ]);
  });

  it('round trips what it writes, and an empty layout stays empty', () => {
    expect(
      parseHomeLayout({ raw: serializeHomeLayout({ entries: DEFAULT_HOME_ENTRIES }) }),
    ).toEqual(DEFAULT_HOME_ENTRIES);
    expect(parseHomeLayout({ raw: serializeHomeLayout({ entries: [] }) })).toEqual([]);
  });
});

describe('hide and show', () => {
  it('hides an entry and remembers its index and size', () => {
    const result = hideHomeWidget({ entries: DEFAULT_HOME_ENTRIES, id: 'runningNow' });

    expect(result?.index).toBe(2);
    expect(result?.size).toBe('M');
    expect(result?.entries.map((entry) => entry.id)).not.toContain('runningNow');
    expect(hideHomeWidget({ entries: DEFAULT_HOME_ENTRIES, id: 'longRunning' })).toBeNull();
  });

  it('shows an entry at its index, clamped, or last', () => {
    const base = DEFAULT_HOME_ENTRIES;
    const hidden = hideHomeWidget({ entries: base, id: 'needsYou' });
    const back = showHomeWidget({
      entries: hidden?.entries ?? [],
      id: 'needsYou',
      size: 'M',
      index: hidden?.index,
    });

    expect(back).toEqual(base);
    expect(
      showHomeWidget({ entries: base, id: 'mergedThisWeek', size: 'L', index: 99 })?.at(-1),
    ).toEqual({ id: 'mergedThisWeek', size: 'L' });
    expect(showHomeWidget({ entries: base, id: 'spend', size: 'M' })).toBeNull();
  });

  it('keeps the tray in catalog order', () => {
    const hidden = hideHomeWidget({ entries: DEFAULT_HOME_ENTRIES, id: 'spend' });

    expect(trayWidgetsOf({ entries: hidden?.entries ?? [] })).toEqual([
      'spend',
      'mergedThisWeek',
      'longRunning',
      'workflowRules',
      'workspaceSetup',
    ]);
    expect(trayWidgetsOf({ entries: [] })).toHaveLength(10);
  });

  it('picks the next card for focus, else the previous, else none', () => {
    expect(neighbourOf({ ids: ['spend', 'needsYou'], id: 'spend' })).toBe('needsYou');
    expect(neighbourOf({ ids: ['spend', 'needsYou'], id: 'needsYou' })).toBe('spend');
    expect(neighbourOf({ ids: ['spend'], id: 'spend' })).toBeNull();
  });
});
