import { brandId, type SessionId } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import { gridAfterOpen } from '../gridAfterOpen';
import { EMPTY_DRAWER_GRID, type DrawerGrid, type OpenDrawer } from '../state';
import { layoutOntoGrid } from './layoutOntoGrid';

const LEDGER = brandId<SessionId>({ value: 'session-ledger-core' });

const gridOf = ({ panels }: { readonly panels: ReadonlyArray<OpenDrawer> }): DrawerGrid =>
  panels.reduce((grid, entry) => gridAfterOpen({ grid, entry }), EMPTY_DRAWER_GRID);

const kindsOf = ({ grid }: { readonly grid: DrawerGrid }): ReadonlyArray<string> =>
  grid.columns.flat().map((panel) => panel.kind);

const BROWSER: OpenDrawer = { kind: 'browser', sessionId: LEDGER, payload: null };
const SCRIPTS: OpenDrawer = { kind: 'scripts', sessionId: LEDGER, payload: null };
const ASK: OpenDrawer = { kind: 'ask', sessionId: LEDGER, payload: null };

describe('a saved session grid lays out the tools the window already has', () => {
  it('opens nothing when the saved grid names more tools than are open', () => {
    const live = gridOf({ panels: [BROWSER] });
    const saved = gridOf({ panels: [BROWSER, SCRIPTS, ASK] });

    expect(kindsOf({ grid: layoutOntoGrid({ live, saved }) })).toEqual(['browser']);
  });

  it('closes nothing when the saved grid names fewer tools than are open', () => {
    const live = gridOf({ panels: [BROWSER, SCRIPTS] });
    const saved = gridOf({ panels: [BROWSER] });

    expect([...kindsOf({ grid: layoutOntoGrid({ live, saved }) })].sort()).toEqual([
      'browser',
      'scripts',
    ]);
  });

  it('applies the saved widths and splits of the tools that are open', () => {
    const live = gridOf({ panels: [BROWSER, SCRIPTS] });
    const saved: DrawerGrid = {
      ...gridOf({ panels: [BROWSER, SCRIPTS, ASK] }),
      widths: { browser: 520, ask: 300 },
      splits: { 'browser/scripts': 0.4 },
    };

    const next = layoutOntoGrid({ live, saved });

    expect(next.widths.browser).toBe(520);
    expect(next.splits).toEqual({ 'browser/scripts': 0.4 });
  });

  it('keeps the live panels, so they stay bound to where the window is', () => {
    const home: OpenDrawer = { kind: 'scripts', sessionId: null, payload: null };
    const live = gridOf({ panels: [home] });
    const saved = gridOf({ panels: [SCRIPTS] });

    expect(layoutOntoGrid({ live, saved }).columns.flat()).toEqual([home]);
  });

  it('leaves an empty window empty', () => {
    const saved = gridOf({ panels: [BROWSER] });

    expect(layoutOntoGrid({ live: EMPTY_DRAWER_GRID, saved })).toBe(EMPTY_DRAWER_GRID);
  });
});
