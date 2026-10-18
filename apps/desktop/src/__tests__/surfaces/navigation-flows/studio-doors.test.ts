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
        !rows.some((row) => row.door === 'visible' && row.covers.includes(`studio:${kind}`)),
    );

    expect(withoutVisibleDoor).toEqual([]);
  });

  it('puts the Guide and the iPhone page in the Goodboy menu', () => {
    const rows = ALL_ROWS;
    const visibleRowsOf = (kind: string) =>
      rows.filter((row) => row.door === 'visible' && row.covers.includes(`studio:${kind}`));

    expect(visibleRowsOf('guide').map((row) => row.name)).toContain(
      'column: goodboy chip to the guide',
    );
    expect(visibleRowsOf('settings').map((row) => row.name)).toContain(
      'column: goodboy chip to pair an iPhone',
    );
  });
});
