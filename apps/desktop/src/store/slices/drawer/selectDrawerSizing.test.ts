import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AgentId, ArtifactId, MountId, SessionId } from '@goodboy/types';
import {
  DRAWER_INSET,
  LEFT_SIDEBAR_DEFAULT,
  LEFT_SIDEBAR_MAX,
  READER_DRAWER_DEFAULT,
  READER_DRAWER_MAX,
  RIGHT_DRAWER_DEFAULT,
  RIGHT_DRAWER_MAX,
  canDrawerPush,
  drawerAsideWidthOf,
  drawerLayoutOf,
  mainWidthOf,
  type DrawerPlacement,
  type DrawerSizing,
} from '@goodboy/ui';
import type { AppState } from '../../types';
import { selectDrawerPlacement } from './selectDrawerPlacement';
import { selectDrawerSizing } from './selectDrawerSizing';
import type { DrawerRequest } from './state';

const MOUNT_ID: MountId = JSON.parse(JSON.stringify('mount-1'));
const SESSION_ID = 'session-1' as SessionId;
const WINDOWS = [1280, 1440] as const;
const SIDEBARS = [LEFT_SIDEBAR_DEFAULT, LEFT_SIDEBAR_MAX] as const;
const SAVED_WIDTHS: Readonly<Record<DrawerSizing, ReadonlyArray<number>>> = {
  side: [RIGHT_DRAWER_DEFAULT, RIGHT_DRAWER_MAX],
  reader: [READER_DRAWER_DEFAULT, READER_DRAWER_MAX],
};

const EVERY_KIND: ReadonlyArray<DrawerRequest> = [
  {
    kind: 'check-analysis',
    sessionId: SESSION_ID,
    payload: {
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      checkUrl: 'https://github.com/harborline/payments-api/actions/runs/31/job/42',
    },
  },
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
  { kind: 'new', sessionId: SESSION_ID, payload: { form: 'run' } },
  { kind: 'transcript', sessionId: SESSION_ID, payload: { agentId: 'agent-1' as AgentId } },
  {
    kind: 'file-diff',
    sessionId: SESSION_ID,
    payload: { source: { kind: 'worktree', worktreePath: '/work/ledger-core' }, path: null },
  },
];

const sizingOf = (drawer: DrawerRequest): DrawerSizing =>
  selectDrawerSizing({
    drawer,
    currentSessionId: SESSION_ID,
  } satisfies Pick<AppState, 'drawer' | 'currentSessionId'>);

const placementOf = (drawer: DrawerRequest): DrawerPlacement =>
  selectDrawerPlacement({
    drawer,
    currentSessionId: SESSION_ID,
  } satisfies Pick<AppState, 'drawer' | 'currentSessionId'>);

const CASES = EVERY_KIND.flatMap((drawer) =>
  [sizingOf(drawer)].flatMap((sizing) =>
    WINDOWS.flatMap((windowPx) =>
      SIDEBARS.flatMap((sidebarPx) =>
        SAVED_WIDTHS[sizing].map((savedPx) => ({
          kind: drawer.kind,
          sizing,
          placement: placementOf(drawer),
          windowPx,
          savedPx,
          columnWidth: windowPx - sidebarPx,
        })),
      ),
    ),
  ),
);

type FrameParams = {
  readonly keyframes: string;
};

const fromFrameOf = ({ keyframes }: FrameParams): string => {
  const styles = readFileSync(join(__dirname, '..', '..', '..', 'styles.css'), 'utf8');
  const block = new RegExp(`@keyframes ${keyframes} \\{[\\s\\S]*?from \\{([\\s\\S]*?)\\}`).exec(
    styles,
  );
  if (block === null) {
    throw new Error(`${keyframes} has no from frame`);
  }
  return block[1] ?? '';
};

const slideOf = (keyframes: string): number => {
  const slide = /translateX\((-?\d+)px\)/.exec(fromFrameOf({ keyframes }));
  if (slide === null) {
    throw new Error(`${keyframes} must slide in with translateX in px`);
  }
  return Math.abs(Number(slide[1]));
};

const SIZING_BY_KIND: ReadonlyArray<readonly [DrawerRequest['kind'], DrawerSizing]> = [
  ['check-analysis', 'side'],
  ['context', 'side'],
  ['explore-file', 'reader'],
  ['artifact', 'side'],
  ['artifact-document', 'reader'],
  ['plan-part', 'side'],
  ['scriptRun', 'side'],
  ['conversation', 'side'],
  ['ask', 'side'],
  ['new', 'reader'],
  ['transcript', 'side'],
  ['file-diff', 'reader'],
];

describe('the tier of every drawer', () => {
  it.each(SIZING_BY_KIND)('opens %s in the %s tier', (kind, sizing) => {
    const drawer = EVERY_KIND.find((candidate) => candidate.kind === kind);
    if (drawer === undefined) {
      throw new Error(`${kind} is listed`);
    }
    expect(sizingOf(drawer)).toBe(sizing);
  });

  it('lists a tier for every drawer kind', () => {
    expect(SIZING_BY_KIND.map(([kind]) => kind).sort()).toEqual(
      EVERY_KIND.map((drawer) => drawer.kind).sort(),
    );
  });

  it('keeps a plan in the reader tier, with no way to expand it over the page', () => {
    const plan = EVERY_KIND.find((drawer) => drawer.kind === 'artifact-document');
    if (plan === undefined) {
      throw new Error('the plan request is listed');
    }
    expect(sizingOf(plan)).toBe('reader');
  });

  it('lays only the New drawer over the page at every width', () => {
    const placed = EVERY_KIND.filter((drawer) => placementOf(drawer) === 'overlay');

    expect(placed.map((drawer) => drawer.kind)).toEqual(['new']);
  });

  it('keeps a closed drawer in the side tier', () => {
    expect(
      selectDrawerSizing({
        drawer: null,
        currentSessionId: SESSION_ID,
      } satisfies Pick<AppState, 'drawer' | 'currentSessionId'>),
    ).toBe('side');
  });
});

describe('every drawer fits inside its aside at 1280 and 1440', () => {
  it('opens the transcript at the same sizing as Ask', () => {
    const ask = EVERY_KIND.find((drawer) => drawer.kind === 'ask');
    const transcript = EVERY_KIND.find((drawer) => drawer.kind === 'transcript');
    if (ask === undefined || transcript === undefined) {
      throw new Error('ask and transcript requests are listed');
    }
    expect(sizingOf(transcript)).toBe(sizingOf(ask));
    expect(sizingOf(transcript)).toBe('side');
  });

  it('slides an overlay card in by at most its 8px inset and grows a pushing card in place', () => {
    expect(slideOf('drawer-overlay-in')).toBeLessThanOrEqual(DRAWER_INSET);
    expect(fromFrameOf({ keyframes: 'fold-fade-in' })).not.toContain('transform');
  });

  it.each(CASES)(
    '$kind ($sizing, $placement) at $windowPx with a $savedPx saved width over a $columnWidth column',
    ({ sizing, placement, columnWidth, savedPx }) => {
      const { mode, width: drawerWidthPx } = drawerLayoutOf({
        main: columnWidth,
        sizing,
        savedWidth: savedPx,
        placement,
      });
      const asidePx = drawerAsideWidthOf({ width: drawerWidthPx, mode });
      const cardRight = columnWidth - asidePx + DRAWER_INSET + drawerWidthPx;

      expect(asidePx).toBeLessThanOrEqual(columnWidth);
      if (mode === 'push') {
        expect(cardRight + DRAWER_INSET).toBe(columnWidth);
        expect(mainWidthOf({ columnWidth, mode, drawerWidthPx }) + asidePx).toBe(columnWidth);
        expect(canDrawerPush({ mainWidthPx: columnWidth, drawerWidthPx })).toBe(true);
        return;
      }
      expect(cardRight).toBe(columnWidth);
    },
  );
});
