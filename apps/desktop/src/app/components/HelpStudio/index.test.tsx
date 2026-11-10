// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

const { mocks } = vi.hoisted(() => ({ mocks: { openUrl: vi.fn(async () => undefined) } }));

vi.mock('../../../shared/lib/editor', () => ({ openUrl: mocks.openUrl }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  storySpies,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { SPONSOR_URL } from '../../../shared/lib/productLinks';
import { clearGuideChapter } from '../../../features/settings/components/GuideStudio/guideChapterRequest';
import { StudioFrame } from '../StudioFrame';
import { HelpStudio } from './index';
import type { HelpTab } from './helpTabs';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation(() => new Promise<never>(() => undefined));
  clearGuideChapter();
});

afterEach(() => {
  cleanup();
});

const HelpHost = () => {
  const kind = useAppStore((state) => state.appStudio?.kind ?? null);
  return (
    <HelpStudio
      tab={kind === 'changelog' ? 'whatsNew' : 'guide'}
      onClose={vi.fn()}
      onOpenScreen={vi.fn()}
    />
  );
};

const renderHelp = (initial: HelpTab = 'guide') => {
  useAppStore.setState({ appStudio: { kind: initial === 'guide' ? 'guide' : 'changelog' } });
  return render(<HelpHost />);
};

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
        <HelpStudio tab="guide" onClose={vi.fn()} onOpenScreen={vi.fn()} />
      </StudioFrame>,
    );

    expect(tab('Guide').getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('searchbox')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^Close/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Back to app/ })).toHaveLength(1);
  });

  it('offers the Guide and What is new tabs and no Shortcuts tab', () => {
    renderHelp();

    expect(screen.getAllByRole('tab').map((entry) => entry.textContent)).toEqual([
      'Guide',
      "What's new",
    ]);
  });

  it('switches the tab by opening the other studio, so Back returns to the first tab', () => {
    renderHelp();
    useAppStore.getState().openStudio({ studio: { kind: 'guide' } });

    expect(tab('Guide').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(tab("What's new"));
    expect(useAppStore.getState().appStudio).toEqual({ kind: 'changelog' });
    expect(tab("What's new").getAttribute('aria-selected')).toBe('true');
    act(() => useAppStore.getState().back());
    expect(useAppStore.getState().appStudio).toEqual({ kind: 'guide' });
    expect(tab('Guide').getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('searchbox')).toHaveLength(1);
  });

  it('holds Sponsor on GitHub as its one outside link', () => {
    renderHelp();

    fireEvent.click(screen.getByRole('button', { name: 'Sponsor on GitHub' }));

    expect(mocks.openUrl).toHaveBeenCalledExactlyOnceWith(SPONSOR_URL);
  });

  it('searches the guide and the releases at once and groups the results by tab', () => {
    renderHelp();

    fireEvent.click(screen.getByRole('button', { name: 'Sponsor on GitHub' }));

    expect(mocks.openUrl).toHaveBeenCalledExactlyOnceWith(SPONSOR_URL);
  });

  it('searches the guide and the releases at once and groups the results by tab', () => {
    renderHelp();

    fireEvent.change(search(), { target: { value: 'search or run' } });

    const labels = hitLabels();
    expect(labels.some((label) => label.endsWith(', Guide'))).toBe(true);
    expect(labels.some((label) => label.endsWith(', Shortcuts'))).toBe(false);
  });

  it('says so when nothing in any tab matches', () => {
    renderHelp();

    fireEvent.change(search(), { target: { value: 'xylophonemarmot' } });

    expect(screen.getByText(/Nothing in help matches/).textContent).toContain('xylophonemarmot');
  });
});
