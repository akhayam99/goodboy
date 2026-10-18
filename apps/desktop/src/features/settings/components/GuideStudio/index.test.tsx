// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { chapterStatsOf } from './chapterStatsOf';
import { GUIDE_CHAPTERS, GUIDE_GROUP_LABEL } from './guideChapters';
import { clearGuideChapter, peekGuideChapter, requestGuideChapter } from './guideChapterRequest';
import { StudioFrame } from '../../../../app/components/StudioFrame';
import { GuideStudio } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearGuideChapter();
  useAppStore.getState().openStudio({ studio: { kind: 'guide' } });
});

afterEach(() => {
  cleanup();
});

const rail = () => screen.getByRole('navigation', { name: 'Guide chapters' });
const search = () => screen.getByRole('searchbox', { name: 'Search the guide' });
const chapterButton = (title: string) => within(rail()).getByRole('button', { name: title });
const page = (title: string) => screen.getByRole('region', { name: title });

const chapterOf = (id: string) => {
  const chapter = GUIDE_CHAPTERS.find((candidate) => candidate.id === id);
  if (chapter === undefined) {
    throw new Error(`no chapter ${id}`);
  }
  return chapter;
};

describe('GuideStudio', () => {
  it('lists every chapter in the rail under its group and opens one chapter at a time', () => {
    render(<GuideStudio onClose={vi.fn()} />);

    const nav = within(rail());
    Object.values(GUIDE_GROUP_LABEL).forEach((label) => expect(nav.getByText(label)).toBeDefined());
    GUIDE_CHAPTERS.forEach((chapter) => expect(chapterButton(chapter.title)).toBeDefined());
    expect(screen.getAllByRole('region')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'What is Goodboy' })).toBeDefined();
    expect(chapterButton('What is Goodboy').getAttribute('aria-current')).toBe('true');
  });

  it('opens a chapter from the rail, titled by it, with its group, points and words in the meta', () => {
    render(<GuideStudio onClose={vi.fn()} />);

    fireEvent.click(chapterButton('Commits'));

    const commits = chapterOf('commits');
    const stats = chapterStatsOf({ chapter: commits });
    expect(screen.getByRole('heading', { level: 1, name: 'Commits' })).toBeDefined();
    expect(
      screen.getByText(`Daily work · ${stats.points} points · ${stats.words} words`),
    ).toBeDefined();
    commits.points.forEach((point) =>
      expect(
        within(page('Commits')).getByRole('heading', { level: 2, name: point.term }),
      ).toBeDefined(),
    );
    expect(chapterButton('Commits').getAttribute('aria-current')).toBe('true');
  });

  it('walks the chapters with Previous and Next', () => {
    render(<GuideStudio onClose={vi.fn()} />);

    fireEvent.click(chapterButton('Commits'));
    fireEvent.click(screen.getByRole('button', { name: 'Next chapter, Artifacts' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Artifacts' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Previous chapter, Commits' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Previous chapter, Review and the Branch page' }),
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Review and the Branch page' }),
    ).toBeDefined();
  });

  it('has no Previous on the first chapter and no Next on the last', () => {
    render(<GuideStudio onClose={vi.fn()} />);

    const pager = () => screen.getByRole('navigation', { name: 'More chapters' });
    expect(within(pager()).queryByRole('button', { name: /^Previous chapter/ })).toBeNull();
    fireEvent.click(chapterButton('Legend'));
    expect(within(pager()).queryByRole('button', { name: /^Next chapter/ })).toBeNull();
  });

  it('lists chapters and points that match the search, and Enter opens the first and flashes its point', () => {
    render(<GuideStudio onClose={vi.fn()} />);

    fireEvent.change(search(), { target: { value: 'resolve with auto' } });

    const results = screen.getByRole('list', { name: 'Guide results' });
    expect(within(rail()).getByText('1 result')).toBeDefined();
    expect(
      within(results).getByRole('button', { name: 'A rebase conflict asks, Commits' }),
    ).toBeDefined();
    expect(within(rail()).queryByText('Daily work')).toBeNull();

    fireEvent.keyDown(search(), { key: 'Enter' });

    expect(screen.getByRole('heading', { level: 1, name: 'Commits' })).toBeDefined();
    const flashed = document.querySelector('[data-flash]');
    expect(flashed?.getAttribute('data-guide-point')).toBe('A rebase conflict asks');
    expect(search().getAttribute('value') ?? '').toBe('');
    expect(within(rail()).getByText('Daily work')).toBeDefined();
  });

  it('moves the result Enter opens with the arrow keys', () => {
    render(<GuideStudio onClose={vi.fn()} />);

    fireEvent.change(search(), { target: { value: 'rebase' } });
    const results = within(screen.getByRole('list', { name: 'Guide results' })).getAllByRole(
      'button',
    );
    expect(results.length).toBeGreaterThan(1);
    expect(results[0]?.getAttribute('data-selected')).toBe('true');

    fireEvent.keyDown(search(), { key: 'ArrowDown' });
    const moved = within(screen.getByRole('list', { name: 'Guide results' })).getAllByRole(
      'button',
    );
    expect(moved[1]?.getAttribute('data-selected')).toBe('true');
  });

  it('opens a chapter hit without a flash', () => {
    render(<GuideStudio onClose={vi.fn()} />);

    fireEvent.change(search(), { target: { value: 'open security findings' } });
    fireEvent.click(
      within(screen.getByRole('list', { name: 'Guide results' })).getByRole('button', {
        name: 'Storage and cleanup, Chapter',
      }),
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Storage and cleanup' })).toBeDefined();
    expect(document.querySelector('[data-flash]')).toBeNull();
  });

  it('says so when nothing matches, and Escape brings the chapters back', () => {
    render(<GuideStudio onClose={vi.fn()} />);

    fireEvent.change(search(), { target: { value: 'kubernetes' } });
    expect(within(rail()).getByText('No chapter matches "kubernetes".')).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(chapterButton('What is Goodboy')).toBeDefined();
  });

  it('opens the screen a chapter links to', () => {
    render(<GuideStudio onClose={vi.fn()} />);

    fireEvent.click(chapterButton('Providers and limits'));
    fireEvent.click(
      within(page('Providers and limits')).getByRole('button', { name: 'Open Providers & models' }),
    );

    expect(useAppStore.getState().appStudio).toEqual({
      kind: 'settings',
      focus: { scope: 'providers' },
    });
  });

  it('opens Monitoring and Impact, Spend from their chapters', () => {
    render(<GuideStudio onClose={vi.fn()} />);

    fireEvent.click(chapterButton('Monitoring'));
    fireEvent.click(within(page('Monitoring')).getByRole('button', { name: 'Open Monitoring' }));
    expect(useAppStore.getState().appStudio).toEqual({ kind: 'monitoring' });

    fireEvent.click(chapterButton('Providers and limits'));
    fireEvent.click(
      within(page('Providers and limits')).getByRole('button', { name: 'Open Impact, Spend' }),
    );
    expect(useAppStore.getState().appStudio).toEqual({ kind: 'impact', scope: { kind: 'spend' } });
  });

  it('closes the guide to show the board', () => {
    render(<GuideStudio onClose={vi.fn()} />);

    fireEvent.click(chapterButton('Board'));
    fireEvent.click(within(page('Board')).getByRole('button', { name: 'Go to the board' }));

    expect(useAppStore.getState().appStudio).toBeNull();
  });

  it('asks for a new session from the New session chapter', () => {
    const listener = vi.fn();
    window.addEventListener('goodboy:new-session', listener);
    render(<GuideStudio onClose={vi.fn()} />);

    fireEvent.click(chapterButton('New session'));
    fireEvent.click(
      within(page('New session')).getByRole('button', { name: 'Start a new session' }),
    );

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('goodboy:new-session', listener);
  });

  it('reads the keys from the shortcut registry', () => {
    render(<GuideStudio onClose={vi.fn()} />);

    fireEvent.click(chapterButton('Keyboard shortcuts'));

    const keyboard = within(page('Keyboard shortcuts'));
    expect(keyboard.getByRole('heading', { level: 2, name: 'Command palette' })).toBeDefined();
    expect(keyboard.getByText(shortcutGlyphs('palette.open'))).toBeDefined();
    expect(keyboard.queryByText('New terminal tab')).toBeNull();
  });

  it('opens on the chapter a caller asked for, through the old id of a renamed chapter too', async () => {
    requestGuideChapter('history');
    render(<GuideStudio onClose={vi.fn()} />);

    expect(chapterButton('Commits').getAttribute('aria-current')).toBe('true');
    await waitFor(() => expect(peekGuideChapter()).toBeNull());
  });

  it('opens What is Goodboy for an id it does not know', () => {
    requestGuideChapter('gone-chapter');
    render(<GuideStudio onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'What is Goodboy' })).toBeDefined();
  });

  it('turns to the chapter a caller asks for while the guide is already open', () => {
    render(<GuideStudio onClose={vi.fn()} />);
    fireEvent.change(search(), { target: { value: 'limit' } });

    act(() => requestGuideChapter('legend'));

    expect(screen.getByRole('heading', { level: 1, name: 'Legend' })).toBeDefined();
    expect(chapterButton('Legend').getAttribute('aria-current')).toBe('true');
    expect(peekGuideChapter()).toBeNull();
  });

  it('names the board columns the way the board does', () => {
    render(<GuideStudio onClose={vi.fn()} />);

    fireEvent.click(chapterButton('Board'));

    const board = within(page('Board'));
    expect(board.getByText('needs you')).toBeDefined();
    expect(board.getByText('in review')).toBeDefined();
  });

  it('draws the session marks of the shell in the Legend, one node per row', () => {
    render(<GuideStudio onClose={vi.fn()} />);

    fireEvent.click(chapterButton('Legend'));

    const legend = page('Legend');
    const marks = within(legend).getByText('Session marks').parentElement;
    const states = Array.from(marks?.querySelectorAll('[data-node-state]') ?? []).map((node) =>
      node.getAttribute('data-node-state'),
    );
    expect(states).toEqual([
      'running',
      'question',
      'approval',
      'alert',
      'failed',
      'approved',
      'merging',
      'marker',
      'marker',
      'finished',
      'closed',
      'queued',
    ]);
    expect(within(legend).getByText('Dots in the sidebar, rail and panes')).toBeDefined();
  });

  it('keeps the asked chapter when the frame mounts the guide twice', () => {
    requestGuideChapter('monitoring');
    const { unmount } = render(<GuideStudio onClose={vi.fn()} />);
    unmount();
    render(<GuideStudio onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Monitoring' })).toBeDefined();
  });

  it('draws no band in the frame and puts Close last in the chapter header beside the rail', () => {
    const { container } = render(
      <StudioFrame kind="guide" onClose={vi.fn()}>
        <GuideStudio onClose={vi.fn()} />
      </StudioFrame>,
    );

    expect(container.querySelector('[data-studio-band]')).toBeNull();
    const title = screen.getByRole('heading', { level: 1, name: 'What is Goodboy' });
    const detail = container.querySelector<HTMLElement>('[data-studio-detail]');
    const header = title.closest('[data-slot="pane-header"]');
    expect(detail?.contains(title)).toBe(true);
    expect(rail().closest('aside')?.contains(title)).toBe(false);
    expect(header?.contains(screen.getByRole('button', { name: 'Close guide' }))).toBe(true);
    expect(title.closest('[data-page-column]')?.getAttribute('data-width')).toBe('column');
  });
});
