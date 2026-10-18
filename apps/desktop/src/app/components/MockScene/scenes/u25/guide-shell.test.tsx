// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { clearGuideChapter } from '../../../../../features/settings/components/GuideStudio/guideChapterRequest';
import { MOCK_SCENES } from '../..';
import { U25_GUIDE_SHELL_SCENES } from './guide-shell';

const SETTLE_MS = 2_000;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearGuideChapter();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: string): Promise<Element> => {
  const Scene = U25_GUIDE_SHELL_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`no scene ${name}`);
  }
  const { container } = render(<Scene />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return container;
};

describe('the guide shell scenes', () => {
  it('registers both scenes for the capture', () => {
    expect(Object.keys(U25_GUIDE_SHELL_SCENES).sort()).toEqual(['guide-legend', 'guide-shell']);
    expect(MOCK_SCENES['guide-shell']).toBe(U25_GUIDE_SHELL_SCENES['guide-shell']);
    expect(MOCK_SCENES['guide-legend']).toBe(U25_GUIDE_SHELL_SCENES['guide-legend']);
  });

  it('guide-shell opens on the sidebar and session rail chapter', async () => {
    await mount('guide-shell');

    const rail = within(screen.getByRole('navigation', { name: 'Guide chapters' }));
    expect(
      rail.getByRole('button', { name: 'Sidebar and session rail' }).getAttribute('aria-current'),
    ).toBe('true');
    const chapter = within(screen.getByRole('region', { name: 'Sidebar and session rail' }));
    ['Sidebar', 'Session rail', 'Levels', 'Session tools'].forEach((term) =>
      expect(chapter.getByText(term)).toBeDefined(),
    );
  });

  it('guide-legend draws the session marks and the dots of the shell', async () => {
    await mount('guide-legend');

    const legend = within(screen.getByRole('region', { name: 'Legend' }));
    expect(legend.getByText('Session marks')).toBeDefined();
    expect(legend.getByText('Dots in the sidebar, rail and panes')).toBeDefined();
    expect(legend.getByText('merge queue')).toBeDefined();
  });

  it.each(Object.keys(U25_GUIDE_SHELL_SCENES))(
    '%s has no accessibility violation once drawn',
    async (name) => {
      const container = await mount(name);
      vi.useRealTimers();

      const { violations } = await runA11yCheck(container);

      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
