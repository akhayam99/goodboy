// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { ChevronLeft } from 'lucide-react';
import { Trail } from '@goodboy/ui';
import { ToastProvider } from '../../shared/components/Toast';
import { MOCK_SCENES } from '../../app/components/MockScene';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../store/storyHarness';

const SRC = join(__dirname, '..', '..');
const TRAIL = '[data-slot="trail"]';
const BACK_GLYPH = '.lucide-chevron-left, .lucide-arrow-left';
const BACK_CHARACTERS = /[‹←]/;
const SESSION_SCENE = 'shell';
const SESSION_RAIL = '[data-session-rail]';

const KEPT = [
  'SettingsColumnNav.tsx',
  'RepoEntryPanel.tsx',
  'QuestionPager.tsx',
  'HandoffPanel.tsx',
];

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  window.history.replaceState(null, '', '/?scene=shell');
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

const hasBackGlyph = (trail: Element): boolean =>
  trail.querySelector(BACK_GLYPH) !== null || BACK_CHARACTERS.test(trail.textContent ?? '');

const sourcesOf = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return sourcesOf(path);
    }
    return name.endsWith('.tsx') && !name.includes('.test.') ? [path] : [];
  });

type ActionsParams = {
  readonly source: string;
};

const paneShellActionsOf = ({ source }: ActionsParams): ReadonlyArray<string> => {
  const found: Array<string> = [];
  let from = source.indexOf('<PaneShell');
  while (from !== -1) {
    const open = source.indexOf('actions={', from);
    const close = source.indexOf('>', from);
    if (open !== -1 && (close === -1 || open < close || source.indexOf('{', from) < close)) {
      let depth = 0;
      let end = open + 'actions='.length;
      for (; end < source.length; end += 1) {
        depth += source[end] === '{' ? 1 : source[end] === '}' ? -1 : 0;
        if (depth === 0) {
          break;
        }
      }
      found.push(source.slice(open, end + 1));
    }
    from = source.indexOf('<PaneShell', from + 1);
  }
  return found;
};

describe('no back glyph in a trail', () => {
  it('draws the session trail with no back glyph, no back row in the session rail, and names every back glyph Back', async () => {
    const Scene = MOCK_SCENES[SESSION_SCENE];
    if (Scene === undefined) {
      throw new Error(`no scene ${SESSION_SCENE}`);
    }
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    await waitFor(() => expect(document.querySelector(SESSION_RAIL)).not.toBeNull(), {
      timeout: 4_000,
    });
    expect(Array.from(document.querySelectorAll(TRAIL)).filter(hasBackGlyph)).toEqual([]);
    const glyphs = Array.from(document.querySelectorAll(BACK_GLYPH));
    expect(document.querySelector(SESSION_RAIL)?.getAttribute('data-session-rail')).toBe('session');
    expect(glyphs.some((glyph) => glyph.closest(SESSION_RAIL) !== null)).toBe(false);
    for (const glyph of glyphs) {
      expect(glyph.closest('button')?.getAttribute('aria-label') ?? '').toMatch(/^Back/);
    }
  });

  it('fails on a fixture trail that carries a chevron-left before its segments', () => {
    const { container } = render(
      <div>
        <ChevronLeft aria-hidden />
        <Trail segments={[{ id: 'runs', label: 'Runs', icon: ChevronLeft }]} />
      </div>,
    );
    const trail = container.querySelector(TRAIL);

    if (trail === null) {
      throw new Error('no trail drawn');
    }
    expect(hasBackGlyph(trail)).toBe(true);
  });

  it('keeps ArrowLeft out of every PaneShell actions slot outside the kept pages', () => {
    const offenders = sourcesOf(join(SRC, 'features'))
      .filter((path) => !KEPT.some((name) => path.endsWith(name)))
      .filter((path) =>
        paneShellActionsOf({ source: readFileSync(path, 'utf8') }).some((actions) =>
          actions.includes('ArrowLeft'),
        ),
      )
      .map((path) => path.slice(SRC.length + 1));

    expect(offenders).toEqual([]);
  });
});
