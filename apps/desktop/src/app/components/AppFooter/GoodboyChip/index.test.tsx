// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { OnboardingStepId } from '../../../../features/onboarding/onboarding-store';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';

const { mocks } = vi.hoisted(() => ({
  mocks: {
    progress: {
      completedCount: 3,
      totalCount: 6,
      completed: new Set<OnboardingStepId>(['provider', 'project', 'codeHost']),
      collapsed: true,
      finished: false,
      wizardDone: true,
      isDone: false,
      hasProjects: true,
    },
    hasDraft: false,
    collapse: vi.fn(),
    finish: vi.fn(),
    openUrl: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../features/onboarding/onboarding-store', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  collapse: mocks.collapse,
  finish: mocks.finish,
}));

vi.mock('../../../../features/onboarding/hooks/useOnboardingProgress', () => ({
  useOnboardingProgress: () => mocks.progress,
}));

vi.mock('../../../../features/onboarding/SetupChecklist/ChecklistBody', () => ({
  ChecklistBody: () => <div data-testid="checklist" />,
}));

vi.mock('../../../../features/settings/hooks/useHasBugReportDraft', () => ({
  useHasBugReportDraft: () => mocks.hasDraft,
}));

vi.mock('../../../../features/updater/hooks/useRunningAgentCount', () => ({
  useRunningAgentCount: () => 0,
}));

vi.mock('../../../../shared/lib/editor', () => ({
  openUrl: mocks.openUrl,
}));

import { applyDocumentTheme } from '../../../../shared/lib/theme';
import { APP_VERSION } from '../../../../shared/lib/appVersion';
import { SOCIAL_LINKS, SPONSOR_URL } from '../../../../shared/lib/productLinks';
import { GoodboyChip } from './index';
import { OPEN_REPORT_SHEET_EVENT } from '../../../../features/bug-report/openReportSheet';

const REST_LABEL = 'Goodboy beta: version, help and sponsor';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ updateVersion: '0.5.2' });
  mocks.progress.collapsed = true;
  mocks.progress.finished = false;
  mocks.progress.isDone = false;
  mocks.progress.hasProjects = true;
  mocks.progress.wizardDone = true;
  mocks.progress.completed = new Set<OnboardingStepId>(['provider', 'project', 'codeHost']);
  mocks.hasDraft = false;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  applyDocumentTheme({ theme: 'dark' });
});

const renderChip = () => {
  const onOpenChangelog = vi.fn();
  const onOpenShortcuts = vi.fn();
  render(<GoodboyChip onOpenChangelog={onOpenChangelog} onOpenShortcuts={onOpenShortcuts} />);
  return { onOpenChangelog, onOpenShortcuts };
};

const openMenu = () => {
  fireEvent.click(screen.getByTestId('goodboy-chip'));
  return screen.getByRole('dialog', { name: 'Goodboy' });
};

describe('GoodboyChip', () => {
  it('names Goodboy, beta and the version the build stamped at rest', () => {
    mocks.progress.finished = true;
    renderChip();

    const chip = screen.getByRole('button', { name: REST_LABEL });
    expect(chip.textContent).toBe(`GoodboyBetav${APP_VERSION}`);
  });

  it('leaves the rest mark bare in dark mode', () => {
    mocks.progress.finished = true;
    renderChip();

    const chip = screen.getByRole('button', { name: REST_LABEL });
    expect(chip.className).not.toContain('goodboy-brand-chip');
  });

  it('wraps the rest mark in a dark chip when the theme is light', () => {
    mocks.progress.finished = true;
    applyDocumentTheme({ theme: 'light' });
    renderChip();

    const chip = screen.getByRole('button', { name: REST_LABEL });
    expect(chip.className).toContain('goodboy-brand-chip');
  });

  it('never puts the dark chip on the setup or update states', () => {
    applyDocumentTheme({ theme: 'light' });
    renderChip();

    const chip = screen.getByRole('button', { name: 'Goodboy: setup is not finished' });
    expect(chip.className).not.toContain('goodboy-brand-chip');
  });

  it('says setup and its progress while setup is open', () => {
    renderChip();

    const chip = screen.getByRole('button', { name: 'Goodboy: setup is not finished' });
    expect(chip.textContent).toBe('Setup3 of 6');
  });

  it('puts a ready update ahead of setup', () => {
    useAppStore.setState({ updaterStatus: 'available' });
    renderChip();

    const chip = screen.getByRole('button', { name: 'Goodboy: an update is ready' });
    expect(chip.textContent).toBe('0.5.2 available');
    expect(within(openMenu()).getByRole('button', { name: 'Restart to update' })).toBeDefined();
  });

  it('holds the version, setup and every product place in one popover', () => {
    renderChip();

    const menu = openMenu();

    within(menu).getByText(`Goodboy ${APP_VERSION}`);
    expect(within(menu).getByTestId('checklist')).toBeDefined();
    ['Report a bug', "What's new", 'Keyboard shortcuts', 'Sponsor on GitHub'].forEach((row) => {
      expect(within(menu).getByText(row)).toBeDefined();
    });
    expect(within(menu).queryByRole('button', { name: 'Restart to update' })).toBeNull();
  });

  it('skips setup from the popover', () => {
    renderChip();

    fireEvent.click(within(openMenu()).getByRole('button', { name: 'Skip setup' }));

    expect(mocks.finish).toHaveBeenCalledOnce();
  });

  it("opens what's new and shortcuts, and closes on the way out", () => {
    const { onOpenChangelog, onOpenShortcuts } = renderChip();

    fireEvent.click(within(openMenu()).getByText("What's new"));
    expect(onOpenChangelog).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Goodboy' })).toBeNull();

    fireEvent.click(within(openMenu()).getByText('Keyboard shortcuts'));
    expect(onOpenShortcuts).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Goodboy' })).toBeNull();
  });

  it('opens the exact sponsor URL', () => {
    renderChip();

    fireEvent.click(within(openMenu()).getByText('Sponsor on GitHub'));

    expect(mocks.openUrl).toHaveBeenCalledExactlyOnceWith(SPONSOR_URL);
    expect(SPONSOR_URL).toBe('https://github.com/sponsors/akhayam99');
  });

  it('opens the exact X profile', () => {
    renderChip();

    fireEvent.click(within(openMenu()).getByText('Follow on X'));

    expect(mocks.openUrl).toHaveBeenCalledExactlyOnceWith(SOCIAL_LINKS.x);
    expect(SOCIAL_LINKS.x).toBe('https://x.com/GoodboyWorks');
  });

  it('leads with report a bug, says a draft is saved, and hands off to the report sheet', () => {
    mocks.hasDraft = true;
    const listener = vi.fn();
    window.addEventListener(OPEN_REPORT_SHEET_EVENT, listener);
    renderChip();

    const menu = openMenu();
    expect(within(menu).getByText('Draft saved')).toBeDefined();
    const rows = within(menu).getAllByRole('button');
    expect(rows[0]?.textContent).toContain('Report a bug');
    fireEvent.click(within(menu).getByText('Report a bug'));

    expect(listener).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Goodboy' })).toBeNull();
    window.removeEventListener(OPEN_REPORT_SHEET_EVENT, listener);
  });

  it('opens itself once after the first agent finishes, then remembers it did', async () => {
    mocks.progress.collapsed = false;
    mocks.progress.completed = new Set<OnboardingStepId>(['provider', 'project', 'firstSession']);
    await act(async () => {
      renderChip();
    });

    expect(mocks.collapse).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog', { name: 'Goodboy' })).toBeDefined();
  });

  it('never opens itself before the first agent finishes', async () => {
    mocks.progress.collapsed = false;
    await act(async () => {
      renderChip();
    });

    expect(mocks.collapse).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Goodboy' })).toBeNull();
  });

  it('never opens itself over the setup wizard', async () => {
    mocks.progress.collapsed = false;
    mocks.progress.wizardDone = false;
    mocks.progress.completed = new Set<OnboardingStepId>(['provider', 'project', 'firstSession']);
    await act(async () => {
      renderChip();
    });

    expect(mocks.collapse).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Goodboy' })).toBeNull();
  });
});
