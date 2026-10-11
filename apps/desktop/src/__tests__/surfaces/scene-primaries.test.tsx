// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../shared/components/Toast';
import { MOCK_SCENES } from '../../app/components/MockScene';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../store/storyHarness';
import allowed from './scene-primaries.allow.json';

const SCENE_SETTLE_MS = 10_000;
const ALLOW_PATH = 'apps/desktop/src/__tests__/surfaces/scene-primaries.allow.json';
const SURFACE =
  '[role="group"][data-surface], [data-slot="pane-header"], [data-slot="pane-dock"], section, aside, [role="dialog"]';
const PAGE_HEADER = '[data-slot="pane-header"]';
const CONFIRM = '[role="group"][data-surface]';

const CURATED = [
  'branch-push',
  'branch-comments',
  'branch-pr-github',
  'branch-pr-none',
  'resolve-failed',
  'fix-run-question',
  'fix-run',
  'overview-full',
  'session-states',
  'workflow-run',
  'workflow-run-plan-review',
  'plan-drawer-waiting',
  'artifact-states',
  'scripts-lens',
  'session-ask',
  'header-overview-overflow',
  'header-agent',
  'header-artifact-details',
  'header-run',
  'header-branch-push-confirm',
  'header-scripts',
  'run-header-held',
  'run-header-paused',
  'run-header-failed',
  'run-header-archived',
] as const;

const RUN_SCENES = [
  'header-run',
  'workflow-run',
  'workflow-run-scrolled',
  'workflow-run-plan-review',
  'workflow-run-plan-question',
  'workflow-run-step-question',
  'run-header-held',
  'run-header-paused',
  'run-header-failed',
  'run-header-archived',
] as const;

const PLAN_ENTRY = /^(Review|Open|Approve) plan$/;
const MENU_TRIGGER_IN_HEADER = `${PAGE_HEADER} button[aria-haspopup="menu"][data-size]`;

const ALLOW: Readonly<Record<string, number>> = allowed;

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
});

const primariesPerSurface = (): ReadonlyArray<number> => {
  const counts = new Map<Element, number>();
  document.querySelectorAll('button[data-variant="primary"]').forEach((button) => {
    const surface = button.closest(SURFACE) ?? button;
    counts.set(surface, (counts.get(surface) ?? 0) + 1);
  });
  return Array.from(counts.values());
};

const confirmPrimaryBesidesHeader = (): boolean =>
  document.querySelector(`${CONFIRM} button[data-variant="primary"]`) !== null &&
  Array.from(document.querySelectorAll(`${PAGE_HEADER} button[data-variant="primary"]`)).some(
    (button) => button.closest(CONFIRM) === null,
  );

const settleScene = async (id: string): Promise<void> => {
  const Scene = MOCK_SCENES[id];
  expect(Scene, `${id} is a registered scene`).toBeDefined();
  if (Scene === undefined) {
    return;
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SCENE_SETTLE_MS);
  });
  vi.useRealTimers();
};

describe('one entry per intent on the run page', () => {
  it.each(RUN_SCENES)('scene %s offers the plan at most once', async (id) => {
    await settleScene(id);

    const entries = screen.queryAllByRole('button', { name: PLAN_ENTRY });
    expect(entries.length).toBeLessThanOrEqual(1);
  });

  it.each(RUN_SCENES)('scene %s draws at most one menu trigger in its header', async (id) => {
    await settleScene(id);

    expect(document.querySelectorAll(MENU_TRIGGER_IN_HEADER).length).toBeLessThanOrEqual(1);
  });
});

describe('one filled primary per surface', () => {
  it.each(CURATED)('scene %s', async (id) => {
    const Scene = MOCK_SCENES[id];
    expect(Scene, `${id} is a registered scene`).toBeDefined();
    if (Scene === undefined) {
      return;
    }
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SCENE_SETTLE_MS);
    });
    vi.useRealTimers();

    const most = Math.max(0, ...primariesPerSurface());
    expect(most).toBeLessThanOrEqual(ALLOW[id] ?? 1);
    expect(confirmPrimaryBesidesHeader()).toBe(false);
  });

  it('keeps the allow file to scenes that are curated and counts that are still above one', () => {
    Object.entries(ALLOW).forEach(([id, count]) => {
      expect(CURATED as ReadonlyArray<string>).toContain(id);
      expect(count).toBeGreaterThan(1);
    });
  });

  it('only lets an allow entry shrink against the base file in git', () => {
    let base: string;
    try {
      base = execFileSync('git', ['show', `origin/main:${ALLOW_PATH}`], {
        cwd: join(__dirname, '..', '..', '..', '..', '..'),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      return;
    }
    const before: Readonly<Record<string, number>> = JSON.parse(base);
    const now: Readonly<Record<string, number>> = JSON.parse(
      readFileSync(join(__dirname, 'scene-primaries.allow.json'), 'utf8'),
    );
    Object.entries(now).forEach(([id, count]) => {
      expect(count).toBeLessThanOrEqual(before[id] ?? 1);
    });
  });
});
