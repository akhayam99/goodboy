// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { GUIDE_CHAPTERS } from './guideChapters';
import { GuideStudio } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.getState().openStudio({ studio: { kind: 'guide' } });
});

afterEach(() => {
  cleanup();
});

const rail = () => screen.getByRole('navigation', { name: 'Guide chapters' });

describe('GuideStudio', () => {
  it('lists every chapter in the rail, grouped along the life of a task', () => {
    render(<GuideStudio onClose={vi.fn()} />);

    expect(screen.getByRole('banner', { name: /guide/i })).toBeDefined();
    const nav = within(rail());
    expect(nav.getByText('Start here')).toBeDefined();
    expect(nav.getByText('Life of a task')).toBeDefined();
    expect(nav.getByText('Reference')).toBeDefined();
    GUIDE_CHAPTERS.forEach((chapter) => {
      expect(nav.getByRole('button', { name: chapter.title })).toBeDefined();
      expect(screen.getByRole('region', { name: chapter.title })).toBeDefined();
    });
  });

  it('narrows the rail and the chapters to what the search matches', () => {
    render(<GuideStudio onClose={vi.fn()} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search the guide' }), {
      target: { value: 'codex reset' },
    });

    const nav = within(rail());
    expect(nav.getByRole('button', { name: 'Providers, limits and resets' })).toBeDefined();
    expect(nav.queryByRole('button', { name: 'Board' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Board' })).toBeNull();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search the guide' }), {
      target: { value: 'kubernetes' },
    });
    expect(nav.getByText('No chapter mentions "kubernetes".')).toBeDefined();
  });

  it('opens the screen a chapter links to', () => {
    render(<GuideStudio onClose={vi.fn()} />);

    const providers = screen.getByRole('region', { name: 'Providers, limits and resets' });
    fireEvent.click(within(providers).getByRole('button', { name: 'Open Providers' }));

    expect(useAppStore.getState().appStudio).toEqual({
      kind: 'settings',
      focus: { scope: 'providers' },
    });
  });

  it('closes the guide to show the board', () => {
    render(<GuideStudio onClose={vi.fn()} />);

    const board = screen.getByRole('region', { name: 'Board' });
    fireEvent.click(within(board).getByRole('button', { name: 'Go to the board' }));

    expect(useAppStore.getState().appStudio).toBeNull();
  });

  it('asks for a new session from the setup chapter', () => {
    const listener = vi.fn();
    window.addEventListener('goodboy:new-session', listener);
    render(<GuideStudio onClose={vi.fn()} />);

    const kickoff = screen.getByRole('region', { name: 'New session and setup' });
    fireEvent.click(within(kickoff).getByRole('button', { name: 'Start a new session' }));

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('goodboy:new-session', listener);
  });

  it('reads the keys from the shortcut registry', () => {
    render(<GuideStudio onClose={vi.fn()} />);

    const keyboard = screen.getByRole('region', { name: 'Keyboard' });
    expect(within(keyboard).getByText('Command palette', { selector: 'span' })).toBeDefined();
    expect(within(keyboard).getByText(shortcutGlyphs('palette.open'))).toBeDefined();
  });

  it('names the board columns the way the board does', () => {
    render(<GuideStudio onClose={vi.fn()} />);

    const board = screen.getByRole('region', { name: 'Board' });
    expect(within(board).getByText('needs you')).toBeDefined();
    expect(within(board).getByText('in review')).toBeDefined();
  });
});
