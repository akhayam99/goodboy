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
import { U24_GUIDE_WORDS_SCENES } from './guide-words';

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
  const Scene = U24_GUIDE_WORDS_SCENES[name];
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

describe('the guide words scenes', () => {
  it('registers both scenes for the capture', () => {
    expect(Object.keys(U24_GUIDE_WORDS_SCENES).sort()).toEqual([
      'guide-words',
      'hovercard-legend-link',
    ]);
    expect(MOCK_SCENES['guide-words']).toBe(U24_GUIDE_WORDS_SCENES['guide-words']);
    expect(MOCK_SCENES['hovercard-legend-link']).toBe(
      U24_GUIDE_WORDS_SCENES['hovercard-legend-link'],
    );
  });

  it('guide-words lists What is Goodboy then Words, with its terms drawn', async () => {
    await mount('guide-words');

    const rail = within(screen.getByRole('navigation', { name: 'Guide chapters' }));
    const words = rail.getByRole('button', { name: 'Words' });
    expect(words.getAttribute('aria-current')).toBe('true');
    expect(words.previousElementSibling?.textContent).toBe('What is Goodboy');
    const chapter = within(screen.getByRole('region', { name: 'Words' }));
    ['Workspace', 'Folder', 'Session', 'Agent', 'Turn', 'Limit'].forEach((term) =>
      expect(chapter.getByText(term)).toBeDefined(),
    );
    expect(chapter.getByText('Worktree and branch')).toBeDefined();
  });

  it('hovercard-legend-link ends the card with the link to the legend', async () => {
    await mount('hovercard-legend-link');

    expect(screen.getByRole('button', { name: 'What do these marks mean?' })).toBeDefined();
  });

  it.each(Object.keys(U24_GUIDE_WORDS_SCENES))(
    '%s has no accessibility violation once drawn',
    async (name) => {
      const container = await mount(name);
      vi.useRealTimers();

      const { violations } = await runA11yCheck(container);

      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
