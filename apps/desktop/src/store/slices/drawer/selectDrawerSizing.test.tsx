// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { AgentId, ArtifactId, SessionId } from '@goodboy/types';
import {
  DRAWER_INSET,
  DrawerColumn,
  LEFT_SIDEBAR_DEFAULT,
  LEFT_SIDEBAR_MAX,
  RIGHT_DRAWER_DEFAULT,
  RIGHT_DRAWER_MAX,
  canDrawerPush,
  drawerModeOf,
  drawerWidthOf,
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
const SPACING_STEP_PX = 4;

const trackOf = (drawerWidthPx: number): number => drawerWidthPx + DRAWER_INSET * 2;

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

const stateWith = ({
  drawer,
  isExpanded,
}: {
  readonly drawer: DrawerRequest;
  readonly isExpanded: boolean;
}): AppState =>
  ({
    drawer,
    currentSessionId: SESSION_ID,
    documentDrawerExpanded: { [SESSION_ID]: isExpanded },
  }) as unknown as AppState;

const sizingsOf = (drawer: DrawerRequest): ReadonlyArray<DrawerSizing> => [
  selectDrawerSizing(stateWith({ drawer, isExpanded: false })),
  selectDrawerSizing(stateWith({ drawer, isExpanded: true })),
];

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

const stubColumnWidth = (width: number) => {
  class StubObserver {
    private readonly callback: (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void;
    constructor(callback: (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void) {
      this.callback = callback;
    }
    observe() {
      this.callback([{ contentRect: { width } }]);
    }
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', StubObserver);
};

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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

  it.each(CASES)(
    '$kind ($sizing) at $windowPx with a $savedPx saved width over a $columnWidth column',
    ({ sizing, columnWidth, savedPx }) => {
      const drawerWidthPx = drawerWidthOf({ sizing, columnWidth, resizableWidth: savedPx });
      const mode = drawerModeOf({ isOpen: true, sizing, columnWidth, drawerWidthPx });
      const trackPx = trackOf(drawerWidthPx);
      const asideLeft = columnWidth - trackPx;
      const cardRight = asideLeft + DRAWER_INSET + drawerWidthPx;

      expect(trackPx).toBeLessThanOrEqual(columnWidth);
      expect(cardRight + DRAWER_INSET).toBe(columnWidth);
      expect(cardRight + slideOf('drawer-card-in')).toBeLessThanOrEqual(columnWidth);
      expect(cardRight + slideOf('drawer-overlay-in')).toBeLessThanOrEqual(columnWidth);
      if (mode === 'push') {
        expect(mainWidthOf({ columnWidth, mode, drawerWidthPx }) + trackPx).toBe(columnWidth);
        expect(canDrawerPush({ mainWidthPx: columnWidth, drawerWidthPx })).toBe(true);
      }
    },
  );

  it.each(WINDOWS.flatMap((windowPx) => SIDEBARS.map((sidebarPx) => windowPx - sidebarPx)))(
    'lays the card out as handle, card and inset inside a %ipx column',
    (columnWidth) => {
      stubColumnWidth(columnWidth);
      render(
        <DrawerColumn
          main={<div>main</div>}
          drawer={<div>Fix run</div>}
          ariaLabel="Side panel"
          resizeLabel="Resize side panel"
        />,
      );
      const aside = screen.getByRole('complementary', { name: 'Side panel' });
      const card = aside.querySelector('[data-drawer-card]');
      const track = card?.parentElement ?? null;
      const handle = track?.firstElementChild ?? null;
      const trackPx = trackOf(RIGHT_DRAWER_DEFAULT);

      expect(DRAWER_INSET).toBe(2 * SPACING_STEP_PX);
      expect(aside.style.width).toBe(`${trackPx}px`);
      expect(track?.getAttribute('style')).toContain(`min-width: ${trackPx}px`);
      expect(handle?.classList.contains('w-2')).toBe(true);
      expect(handle?.classList.contains('shrink-0')).toBe(true);
      expect(card?.classList.contains('mr-2')).toBe(true);
      expect(card?.classList.contains('my-2')).toBe(true);
      expect(card?.classList.contains('min-w-0')).toBe(true);
      expect(card?.classList.contains('overflow-hidden')).toBe(true);
      expect(aside.classList.contains('overflow-hidden')).toBe(true);
    },
  );
});
