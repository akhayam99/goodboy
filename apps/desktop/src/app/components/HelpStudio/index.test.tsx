// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { clearGuideChapter } from '../../../features/settings/components/GuideStudio/guideChapterRequest';
import { StudioFrame } from '../StudioFrame';
import { HelpStudio } from './index';

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

type TabId = 'guide' | 'whatsNew' | 'shortcuts';

const renderHelp = (initialTab: TabId = 'guide') =>
  render(<HelpStudio initialTab={initialTab} onClose={vi.fn()} onOpenScreen={vi.fn()} />);

const search = () => screen.getByRole('searchbox', { name: 'Search help' });
const tab = (name: string) => screen.getByRole('tab', { name });
const hitLabels = (): ReadonlyArray<string> =>
  within(screen.getByRole('list', { name: 'Help results' }))
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label') ?? '');

describe('HelpStudio', () => {
  it('opens on the tab it is asked for, with one search and Back to app instead of Close', () => {
    render(
      <StudioFrame kind="guide" onClose={vi.fn()}>
        <HelpStudio initialTab="shortcuts" onClose={vi.fn()} onOpenScreen={vi.fn()} />
      </StudioFrame>,
    );

    expect(tab('Shortcuts').getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('searchbox')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^Close/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Back to app/ })).toHaveLength(1);
  });

  it('switches between the tabs without leaving the studio', () => {
    renderHelp();

    expect(screen.getAllByRole('heading', { level: 1, name: 'What is Goodboy' })).toHaveLength(1);
    fireEvent.click(tab('Shortcuts'));
    expect(screen.getAllByRole('heading', { level: 1, name: 'Shortcuts' })).toHaveLength(1);
    expect(screen.queryByText('Read only')).toBeNull();
    fireEvent.click(tab('Guide'));
    expect(screen.getAllByRole('heading', { level: 1, name: 'What is Goodboy' })).toHaveLength(1);
    expect(screen.getAllByRole('searchbox')).toHaveLength(1);
  });

  it('shows the shortcut sheet read only, with one link to the recorder in Settings', () => {
    renderHelp('shortcuts');

    expect(screen.getAllByText(shortcutGlyphs('palette.open')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^Change keys for/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Customize in Settings' }));

    expect(useAppStore.getState().appStudio).toEqual({
      kind: 'settings',
      focus: { scope: 'app', section: 'shortcuts' },
    });
  });

  it('searches the guide and the shortcuts at once and groups the results by tab', () => {
    renderHelp();

    fireEvent.change(search(), { target: { value: 'search or run' } });

    const labels = hitLabels();
    expect(labels.some((label) => label.endsWith(', Shortcuts'))).toBe(true);
    expect(labels.some((label) => label.endsWith(', Guide'))).toBe(true);
  });

  it('finds a shortcut by its key and opens the Shortcuts tab from the result', () => {
    renderHelp();

    fireEvent.change(search(), { target: { value: shortcutGlyphs('palette.open') } });
    const hit = within(screen.getByRole('list', { name: 'Help results' }))
      .getAllByRole('button')
      .find((button) => button.getAttribute('aria-label')?.endsWith(', Shortcuts') === true);
    expect(hit).not.toBeUndefined();
    fireEvent.click(hit ?? document.body);

    expect(tab('Shortcuts').getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('list', { name: 'Help results' })).toBeNull();
    expect(search().getAttribute('value') ?? '').toBe('');
  });

  it('says so when nothing in any tab matches', () => {
    renderHelp();

    fireEvent.change(search(), { target: { value: 'xylophonemarmot' } });

    expect(screen.getByText(/Nothing in help matches/).textContent).toContain('xylophonemarmot');
  });
});
