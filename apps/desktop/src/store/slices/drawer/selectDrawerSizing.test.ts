import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AgentId, ArtifactId, SessionId } from '@goodboy/types';
import {
  DRAWER_INSET,
  LEFT_SIDEBAR_DEFAULT,
  LEFT_SIDEBAR_MAX,
  RIGHT_DRAWER_DEFAULT,
  RIGHT_DRAWER_MAX,
  canDrawerPush,
  drawerAsideWidthOf,
  drawerLayoutOf,
  mainWidthOf,
  type DrawerSizing,
} from '@goodboy/ui';
import type { AppState } from '../../types';
import { selectDrawerSizing } from './selectDrawerSizing';
import type { DrawerRequest } from './state';

const SESSION_ID = 'session-1' as SessionId;
const WINDOWS = [1280, 1440] as const;
const SIDEBARS = [LEFT_SIDEBAR_DEFAULT, LEFT_SIDEBAR_MAX] as const;
const SAVED_WIDTHS = [RIGHT_DRAWER_DEFAULT, RIGHT_DRAWER_MAX] as const;

const EVERY_KIND: ReadonlyArray<DrawerRequest> = [
  { kind: 'context', sessionId: SESSION_ID, payload: { tab: 'goal', view: 'current' } },
  {
    kind: 'explore-file',
    sessionId: SESSION_ID,
    payload: {
      sessionDir: '/work/ledger-core',
      entry: {
        name: 'README.md',
        relPath: 'README.md',
        isDir: false,
        sizeBytes: 1,
        modifiedAt: null,
      },
    },
  },
  {
    kind: 'artifact',
    sessionId: SESSION_ID,
    payload: { artifactId: 'artifact-1' as ArtifactId, tab: 'details' },
  },
  {
    kind: 'artifact-document',
    sessionId: SESSION_ID,
    payload: { artifactId: 'plan-1' as ArtifactId, revision: null },
  },
  {
    kind: 'plan-part',
    sessionId: SESSION_ID,
    payload: { planId: 'plan-1' as ArtifactId, index: 0 },
  },
  { kind: 'scriptRun', sessionId: SESSION_ID, payload: { scriptKey: 'test', mountId: null } },
  { kind: 'conversation', sessionId: SESSION_ID, payload: { threadId: 'thread-1' } },
  { kind: 'ask', sessionId: SESSION_ID, payload: null },
  { kind: 'transcript', sessionId: SESSION_ID, payload: { agentId: 'agent-1' as AgentId } },
  {
    kind: 'file-diff',
    sessionId: SESSION_ID,
    payload: { source: { kind: 'worktree', worktreePath: '/work/ledger-core' }, path: null },
  },
];

const sizingsOf = (drawer: DrawerRequest): ReadonlyArray<DrawerSizing> =>
  [false, true].map((isExpanded) =>
    selectDrawerSizing({
      drawer,
      currentSessionId: SESSION_ID,
      documentDrawerExpanded: { [SESSION_ID]: isExpanded },
    } satisfies Pick<AppState, 'drawer' | 'currentSessionId' | 'documentDrawerExpanded'>),
  );

const CASES = EVERY_KIND.flatMap((drawer) =>
  [...new Set(sizingsOf(drawer))].flatMap((sizing) =>
    WINDOWS.flatMap((windowPx) =>
      SIDEBARS.flatMap((sidebarPx) =>
        SAVED_WIDTHS.map((savedPx) => ({
          kind: drawer.kind,
          sizing,
          windowPx,
          savedPx,
          columnWidth: windowPx - sidebarPx,
        })),
      ),
    ),
  ),
);

const slideOf = (keyframes: string): number => {
  const styles = readFileSync(join(__dirname, '..', '..', '..', 'styles.css'), 'utf8');
  const block = new RegExp(`@keyframes ${keyframes} \\{[\\s\\S]*?from \\{([\\s\\S]*?)\\}`).exec(
    styles,
  );
  const slide = /translateX\((-?\d+)px\)/.exec(block?.[1] ?? '');
  if (slide === null) {
    throw new Error(`${keyframes} must slide in with translateX in px`);
  }
  return Math.abs(Number(slide[1]));
};

describe('every drawer fits inside its aside at 1280 and 1440', () => {
  it('opens the transcript at the same sizing as Ask', () => {
    const ask = EVERY_KIND.find((drawer) => drawer.kind === 'ask');
    const transcript = EVERY_KIND.find((drawer) => drawer.kind === 'transcript');
    if (ask === undefined || transcript === undefined) {
      throw new Error('ask and transcript requests are listed');
    }
    expect(sizingsOf(transcript)).toEqual(sizingsOf(ask));
    expect(sizingsOf(transcript)).toEqual(['default', 'default']);
  });

  it('slides a card in by at most its 8px inset, so it never passes the window edge', () => {
    expect(slideOf('drawer-card-in')).toBeLessThanOrEqual(DRAWER_INSET);
    expect(slideOf('drawer-overlay-in')).toBeLessThanOrEqual(DRAWER_INSET);
  });

  it.each(CASES)(
    '$kind ($sizing) at $windowPx with a $savedPx saved width over a $columnWidth column',
    ({ sizing, columnWidth, savedPx }) => {
      const { mode, width: drawerWidthPx } = drawerLayoutOf({
        main: columnWidth,
        sizing,
        savedWidth: savedPx,
      });
      const asidePx = drawerAsideWidthOf({ width: drawerWidthPx, mode });
      const cardRight = columnWidth - asidePx + DRAWER_INSET + drawerWidthPx;

      expect(asidePx).toBeLessThanOrEqual(columnWidth);
      if (mode === 'push') {
        expect(cardRight + DRAWER_INSET).toBe(columnWidth);
        expect(cardRight + slideOf('drawer-card-in')).toBeLessThanOrEqual(columnWidth);
        expect(mainWidthOf({ columnWidth, mode, drawerWidthPx }) + asidePx).toBe(columnWidth);
        expect(canDrawerPush({ mainWidthPx: columnWidth, drawerWidthPx })).toBe(true);
        return;
      }
      expect(cardRight).toBe(columnWidth);
    },
  );
});
