// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { describe, expect, it, vi } from 'vitest';
import { ALL_ROWS, STUDIO_KINDS } from './allRows';

const STUDIO_TOKEN = /^studio:(\w+)$/;
const PALETTE_DOOR_KINDS: ReadonlyArray<string> = ['guide', 'changelog'];

describe('every studio has a door you can see', () => {
  it('lists the studio kinds of the navigation slice', () => {
    expect(STUDIO_KINDS).toContain('guide');
    expect(STUDIO_KINDS).not.toContain('companion');
  });

  it('declares the door of every flow row that reaches a studio', () => {
    const rows = ALL_ROWS;
    const undeclared = rows
      .filter((row) => row.covers.some((token) => STUDIO_TOKEN.test(token)))
      .filter((row) => row.door === undefined)
      .map((row) => row.name);

    expect(undeclared).toEqual([]);
  });

  it('has a visible door row for every studio kind, not only the palette', () => {
    const rows = ALL_ROWS;
    const withoutVisibleDoor = STUDIO_KINDS.filter(
      (kind) =>
        !PALETTE_DOOR_KINDS.includes(kind) &&
        !rows.some((row) => row.door === 'visible' && row.covers.includes(`studio:${kind}`)),
    );

    expect(withoutVisibleDoor).toEqual([]);
  });

  it('leaves the Guide and the What is new tab to the palette, not to a mark in the rail', () => {
    const rows = ALL_ROWS;
    const rowsOf = (kind: string) => rows.filter((row) => row.covers.includes(`studio:${kind}`));

    PALETTE_DOOR_KINDS.forEach((kind) => {
      expect(rowsOf(kind).length).toBeGreaterThan(0);
      expect(rowsOf(kind).filter((row) => row.door === 'visible')).toEqual([]);
      expect(rowsOf(kind).filter((row) => row.door === 'palette').length).toBeGreaterThan(0);
    });
    expect(rows.filter((row) => /goodboy line/i.test(row.name))).toEqual([]);
  });
});
