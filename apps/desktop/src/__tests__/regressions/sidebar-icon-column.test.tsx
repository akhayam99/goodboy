// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { COLLAPSED_RAIL_WIDTH } from '@goodboy/ui';
import { ToastProvider } from '../../shared/components/Toast';
import { applyDocumentTheme } from '../../shared/lib/theme';
import { PLAIN_INSET } from '../../shared/hooks/useTitlebarInset';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../store/storyHarness';
import { clearSceneInvoke } from '../../test/sceneInvoke';
import { U25_R4_WORKSPACE_SCENES } from '../../app/components/MockScene/scenes/u25/r4-workspace';

const SETTLE_MS = 2_000;
const SPACING_PX = 4;
const TOLERANCE_PX = 1;
const COLUMN_X = COLLAPSED_RAIL_WIDTH / 2;
const INSET_VARS: Readonly<Record<string, number>> = {
  '--titlebar-inset': Number.parseFloat(PLAIN_INSET),
};

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
  window.history.replaceState(null, '', '/');
  applyDocumentTheme({ theme: 'dark' });
});

type ClassParams = {
  readonly element: Element;
  readonly prefixes: ReadonlyArray<string>;
};

const spacingOf = ({ element, prefixes }: ClassParams): number => {
  const classes = (element.getAttribute('class') ?? '').split(/\s+/);
  for (const prefix of prefixes) {
    const found = classes.find((entry) => entry.startsWith(`${prefix}-`));
    if (found === undefined) {
      continue;
    }
    const value = found.slice(prefix.length + 1);
    const inset = /^\((--[a-z-]+)\)$/.exec(value);
    if (inset !== null) {
      return INSET_VARS[inset[1] ?? ''] ?? Number.NaN;
    }
    return Number(value) * SPACING_PX;
  }
  return 0;
};

type ElementParams = {
  readonly element: Element;
};

const isOutOfFlow = ({ element }: ElementParams): boolean => {
  const classes = (element.getAttribute('class') ?? '').split(/\s+/);
  return classes.includes('absolute') || classes.includes('sr-only') || classes.includes('fixed');
};

const isRowFlex = ({ element }: ElementParams): boolean => {
  const classes = (element.getAttribute('class') ?? '').split(/\s+/);
  const isFlex = classes.includes('flex') || classes.includes('inline-flex');
  return isFlex && !classes.includes('flex-col');
};

const assertLeading = ({ element }: ElementParams): void => {
  const parent = element.parentElement;
  if (parent === null || !isRowFlex({ element: parent })) {
    return;
  }
  const before = Array.from(element.parentElement?.children ?? []).slice(
    0,
    Array.from(element.parentElement?.children ?? []).indexOf(element),
  );
  const inFlow = before.filter((sibling) => !isOutOfFlow({ element: sibling }));
  if (inFlow.length > 0) {
    throw new Error(`${element.outerHTML.slice(0, 80)} is not the leading child of its row`);
  }
};

const leftOf = ({ element }: ElementParams): number => {
  let x = spacingOf({ element, prefixes: ['ml', 'mx'] });
  let node = element.parentElement;
  let child: Element = element;
  while (node !== null) {
    assertLeading({ element: child });
    x +=
      spacingOf({ element: node, prefixes: ['pl', 'px', 'p'] }) +
      spacingOf({ element: node, prefixes: ['ml', 'mx'] });
    child = node;
    node = node.parentElement;
  }
  return x;
};

const widthOf = ({ element }: ElementParams): number => {
  const fixed = spacingOf({ element, prefixes: ['size', 'w'] });
  if (fixed > 0) {
    return fixed;
  }
  const attribute = element.getAttribute('width');
  if (attribute !== null) {
    return Number(attribute);
  }
  throw new Error(`${element.outerHTML.slice(0, 80)} has no fixed width`);
};

const centerOf = ({ element }: ElementParams): number =>
  leftOf({ element }) + widthOf({ element }) / 2;

type MountParams = {
  readonly name: keyof typeof U25_R4_WORKSPACE_SCENES;
  readonly search?: string;
};

const mount = async ({ name, search = '' }: MountParams): Promise<void> => {
  window.history.replaceState(null, '', `/${search}`);
  const Scene = U25_R4_WORKSPACE_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

type Mark = {
  readonly name: string;
  readonly x: number;
};

const columnMarks = (): ReadonlyArray<Mark> => {
  const tile = document.querySelector('[aria-label^="Switch workspace"] > span[aria-hidden]');
  const slots = Array.from(document.querySelectorAll('nav[aria-label="Sidebar"] [data-nav-icon]'));
  const nodes = Array.from(
    document.querySelectorAll('nav[aria-label="Sidebar"] [data-rail-session]'),
  );
  return [
    ...(tile === null ? [] : [{ name: 'workspace tile', x: centerOf({ element: tile }) }]),
    ...slots.map((slot) => ({
      name: slot.closest('[aria-label]')?.getAttribute('aria-label') ?? 'slot',
      x: centerOf({ element: slot }),
    })),
    ...nodes.map((node) => ({ name: 'rail session', x: centerOf({ element: node }) })),
  ];
};

type ExpectParams = {
  readonly marks: ReadonlyArray<Mark>;
};

const expectOneColumn = ({ marks }: ExpectParams): void => {
  const off = marks.filter((mark) => Math.abs(mark.x - COLUMN_X) > TOLERANCE_PX);
  expect(off).toEqual([]);
};

describe('the main sidebar keeps one icon column', () => {
  it.each(['r4-column-dark', 'r4-column-light'] as const)(
    '%s centers the workspace tile, New session, the doors, the session nodes and Settings on one x',
    async (name) => {
      await mount({ name });

      const marks = columnMarks();
      const names = marks.map((mark) => mark.name);
      expect(names).toContain('workspace tile');
      expect(names).toContain('New session');
      expect(names.some((entry) => entry.startsWith('Sessions'))).toBe(true);
      expect(names).toContain('Terminal');
      expect(names).toContain('Impact');
      expect(names).toContain('Settings');
      expect(
        document.querySelectorAll('button[data-select-id] [data-nav-icon]').length,
      ).toBeGreaterThan(0);
      expectOneColumn({ marks });
    },
  );

  it('keeps the same column on the folded rail', async () => {
    await mount({ name: 'r4-column-dark', search: '?rail=1' });

    const marks = columnMarks();
    expect(marks.map((mark) => mark.name)).toContain('Settings');
    expectOneColumn({ marks });
  });
});
