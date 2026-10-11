// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { GuideStudio } from './components/GuideStudio';
import { clearGuideChapter, peekGuideChapter } from './components/GuideStudio/guideChapterRequest';
import { openGuideChapter } from './openGuideChapter';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearGuideChapter();
});

afterEach(() => {
  cleanup();
});

const LINKS: ReadonlyArray<readonly [string, string, string]> = [
  ['the session hover card', 'legend', 'Legend'],
  ['Impact spend', 'tokens', 'Tokens and cost'],
  ['the worktree menu', 'words', 'Words'],
];

describe.each(LINKS)('the deep link from %s', (_door, id, title) => {
  it('opens the Guide and asks for its chapter', () => {
    openGuideChapter({ id });

    expect(useAppStore.getState().appStudio).toEqual({ kind: 'guide' });
    expect(peekGuideChapter()).toBe(id);
  });

  it('lands the Guide on that chapter', async () => {
    openGuideChapter({ id });
    render(<GuideStudio onClose={vi.fn()} />);

    const rail = screen.getByRole('navigation', { name: 'Guide chapters' });
    await waitFor(() =>
      expect(within(rail).getByRole('button', { name: title }).getAttribute('aria-current')).toBe(
        'true',
      ),
    );
    expect(peekGuideChapter()).toBeNull();
  });

  it('returns to the page you were on when you go Back', () => {
    useAppStore.getState().openStudio({ studio: { kind: 'impact', scope: null } });
    const before = useAppStore.getState().appStudio;
    expect(before).toEqual({ kind: 'impact', scope: null });

    openGuideChapter({ id });
    expect(useAppStore.getState().appStudio).toEqual({ kind: 'guide' });
    useAppStore.getState().back();

    expect(useAppStore.getState().appStudio).toEqual(before);
  });
});
