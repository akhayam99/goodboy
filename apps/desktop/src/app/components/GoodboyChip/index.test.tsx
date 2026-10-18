// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { OnboardingStepId } from '../../../features/onboarding/onboarding-store';
import { setupProgress } from '../../../features/onboarding/setupProgress';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';

const { mocks } = vi.hoisted(() => ({
  mocks: {
    progress: {
      completed: new Set<string>(),
      isCollapsed: true,
      isFinished: false,
      wizard: 'done',
      isWizardDone: true,
      hasWorkspace: true,
      hasProjects: true,
      suggestsProfile: false,
      details: {
        agents: 'Claude is ready',
        workspace: 'Harborline, 3 folders',
        tools: 'Optional',
        'first-session': 'Ask Scout about the code',
      },
    },
    hasDraft: false,
    collapse: vi.fn(),
    finish: vi.fn(),
    openUrl: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../features/onboarding/onboarding-store', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  collapse: mocks.collapse,
  finish: mocks.finish,
}));

vi.mock('../../../features/onboarding/hooks/useOnboardingProgress', () => ({
  useOnboardingProgress: () => ({
    ...mocks.progress,
    setup: setupProgress({ completed: mocks.progress.completed }),
  }),
}));

vi.mock('../../../features/settings/hooks/useHasBugReportDraft', () => ({
  useHasBugReportDraft: () => mocks.hasDraft,
}));

vi.mock('../../../features/updater/hooks/useRunningAgentCount', () => ({
  useRunningAgentCount: () => 0,
}));

vi.mock('../../../shared/lib/editor', () => ({
  openUrl: mocks.openUrl,
}));

import { applyDocumentTheme } from '../../../shared/lib/theme';
import { APP_VERSION } from '../../../shared/lib/appVersion';
import { SOCIAL_LINKS, SPONSOR_URL } from '../../../shared/lib/productLinks';
import { GoodboyChip } from './index';
import { OPEN_REPORT_SHEET_EVENT } from '../../../features/bug-report/openReportSheet';

const REST_LABEL = 'Goodboy beta: version, help and sponsor';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ updateVersion: '0.5.2' });
  mocks.progress.isCollapsed = true;
  mocks.progress.isFinished = false;
  mocks.progress.hasProjects = true;
  mocks.progress.wizard = 'done';
  mocks.progress.isWizardDone = true;
  mocks.progress.completed = new Set<OnboardingStepId>(['agents', 'workspace']);
  mocks.hasDraft = false;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  applyDocumentTheme({ theme: 'dark' });
});

const renderChip = () => {
  const onOpenChangelog = vi.fn();
  const onOpenGuide = vi.fn();
  const onOpenShortcuts = vi.fn();
  render(
    <GoodboyChip
      onOpenChangelog={onOpenChangelog}
      onOpenGuide={onOpenGuide}
      onOpenShortcuts={onOpenShortcuts}
    />,
  );
  return { onOpenChangelog, onOpenGuide, onOpenShortcuts };
};

const openMenu = () => {
  fireEvent.click(screen.getByTestId('goodboy-chip'));
  return screen.getByRole('dialog', { name: 'Goodboy' });
};

describe('GoodboyChip', () => {
  it('names Goodboy, beta and the version the build stamped at rest', () => {
    mocks.progress.isFinished = true;
    renderChip();

    const chip = screen.getByRole('button', { name: REST_LABEL });
    expect(chip.textContent).toBe(`GoodboyBetav${APP_VERSION}`);
  });

  it.each(['dark', 'light'] as const)(
    'wraps only the mark and the name in the brand chip in %s mode',
    (theme) => {
      mocks.progress.isFinished = true;
      applyDocumentTheme({ theme });
      renderChip();

      const chip = screen.getByRole('button', { name: REST_LABEL });
      expect(chip.className).not.toContain('goodboy-brand-chip');
      const brand = chip.querySelector('[data-brand-chip]');
      expect(brand?.className).toContain('goodboy-brand-chip');
      expect(brand?.textContent).toBe('Goodboy');
    },
  );

  it('never draws the brand chip on the setup state', () => {
    applyDocumentTheme({ theme: 'light' });
    renderChip();

    const chip = screen.getByRole('button', { name: 'Goodboy: setup is not finished' });
    expect(chip.querySelector('[data-brand-chip]')).toBeNull();
  });

  it('says setup and its progress while setup is open', () => {
    renderChip();

    const chip = screen.getByRole('button', { name: 'Goodboy: setup is not finished' });
    expect(chip.textContent).toBe('Setup2 of 4');
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

    const header = menu.querySelector('header');
    expect(header?.querySelector('[data-brand-chip]')?.textContent).toBe('Goodboy');
    expect(header?.textContent).toBe(`GoodboyBetav${APP_VERSION}`);
    expect(within(menu).getByRole('region', { name: 'Setup' })).toBeDefined();
    [
      'Report a bug',
      'Guide',
      "What's new",
      'Keyboard shortcuts',
      'Pair your iPhone',
      'Sponsor on GitHub',
    ].forEach((row) => {
      expect(within(menu).getByText(row)).toBeDefined();
    });
    expect(within(menu).queryByRole('button', { name: 'Restart to update' })).toBeNull();
  });

  it('hides setup from the popover', () => {
    renderChip();

    fireEvent.click(within(openMenu()).getByRole('button', { name: 'Hide setup' }));

    expect(mocks.finish).toHaveBeenCalledOnce();
  });

  it('counts the four steps in the menu and the chip from one function', () => {
    renderChip();

    const chip = screen.getByRole('button', { name: 'Goodboy: setup is not finished' });
    const setup = within(openMenu()).getByRole('region', { name: 'Setup' });
    expect(chip.textContent).toContain('2 of 4');
    expect(within(setup).getByText('Setup · 2 of 4')).toBeDefined();
    expect(within(setup).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('2');
    expect(within(setup).getAllByRole('listitem')).toHaveLength(4);
    expect(within(setup).queryByText(/about you/i)).toBeNull();
  });

  it('offers Resume setup while setup is paused, at the step it stopped on', () => {
    mocks.progress.wizard = 'later';
    mocks.progress.isWizardDone = false;
    const listener = vi.fn();
    window.addEventListener('goodboy:open-onboarding-wizard', listener);
    renderChip();

    fireEvent.click(within(openMenu()).getByRole('button', { name: 'Resume setup' }));

    expect(listener).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Goodboy' })).toBeNull();
    window.removeEventListener('goodboy:open-onboarding-wizard', listener);
  });

  it('offers no Resume setup once setup is done', () => {
    renderChip();

    expect(within(openMenu()).queryByRole('button', { name: 'Resume setup' })).toBeNull();
  });

  it('suggests About you after the first session, outside the count', () => {
    mocks.progress.suggestsProfile = true;
    renderChip();

    const setup = within(openMenu()).getByRole('region', { name: 'Setup' });
    expect(within(setup).getByRole('button', { name: 'Open Tell agents about you' })).toBeDefined();
    expect(within(setup).getByText('Setup · 2 of 4')).toBeDefined();
    mocks.progress.suggestsProfile = false;
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

  it('puts the guide first among the help rows and opens it', () => {
    const { onOpenGuide } = renderChip();

    const menu = openMenu();
    const labels = within(menu)
      .getAllByRole('button')
      .map((button) => button.textContent ?? '');
    expect(labels.indexOf('Guide')).toBeGreaterThan(-1);
    expect(labels.indexOf('Guide')).toBeLessThan(labels.indexOf("What's new"));

    fireEvent.click(within(menu).getByText('Guide'));

    expect(onOpenGuide).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Goodboy' })).toBeNull();
  });

  it('asks the app to open the pairing studio from Pair your iPhone', () => {
    const listener = vi.fn();
    window.addEventListener('goodboy:open-pair-device', listener);
    renderChip();

    fireEvent.click(within(openMenu()).getByText('Pair your iPhone'));

    expect(listener).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Goodboy' })).toBeNull();
    window.removeEventListener('goodboy:open-pair-device', listener);
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

  it('leads the help rows with report a bug, says a draft is saved, and hands off to the report sheet', () => {
    mocks.hasDraft = true;
    mocks.progress.isFinished = true;
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
    mocks.progress.isCollapsed = false;
    mocks.progress.completed = new Set<OnboardingStepId>(['agents', 'workspace', 'first-session']);
    await act(async () => {
      renderChip();
    });

    expect(mocks.collapse).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog', { name: 'Goodboy' })).toBeDefined();
  });

  it('never opens itself before the first agent finishes', async () => {
    mocks.progress.isCollapsed = false;
    await act(async () => {
      renderChip();
    });

    expect(mocks.collapse).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Goodboy' })).toBeNull();
  });

  it('never opens itself over the setup wizard', async () => {
    mocks.progress.isCollapsed = false;
    mocks.progress.isWizardDone = false;
    mocks.progress.wizard = 'open';
    mocks.progress.completed = new Set<OnboardingStepId>(['agents', 'workspace', 'first-session']);
    await act(async () => {
      renderChip();
    });

    expect(mocks.collapse).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Goodboy' })).toBeNull();
  });
});

describe('GoodboyChip in the column and on the rail', () => {
  it('spells Goodboy, beta and the version in the column row at every width', () => {
    mocks.progress.isFinished = true;
    render(
      <GoodboyChip
        variant="column"
        onOpenChangelog={vi.fn()}
        onOpenGuide={vi.fn()}
        onOpenShortcuts={vi.fn()}
      />,
    );

    const chip = screen.getByRole('button', { name: REST_LABEL });
    expect(chip.textContent).toBe(`GoodboyBetav${APP_VERSION}`);
    expect(chip.getAttribute('data-goodboy-chip')).toBe('column');
  });

  it('keeps only the mark on the rail, with the state in its name', () => {
    render(
      <GoodboyChip
        variant="rail"
        onOpenChangelog={vi.fn()}
        onOpenGuide={vi.fn()}
        onOpenShortcuts={vi.fn()}
      />,
    );

    const chip = screen.getByRole('button', { name: 'Goodboy: setup is not finished' });
    expect(chip.textContent).toBe('');
    fireEvent.click(chip);
    expect(screen.getByRole('dialog', { name: 'Goodboy' })).toBeDefined();
  });

  it('opens itself only from the primary chip, so a peeked column never opens a second menu', async () => {
    mocks.progress.isCollapsed = false;
    mocks.progress.completed = new Set<OnboardingStepId>(['agents', 'workspace', 'first-session']);
    await act(async () => {
      render(
        <GoodboyChip
          variant="column"
          isPrimary={false}
          onOpenChangelog={vi.fn()}
          onOpenGuide={vi.fn()}
          onOpenShortcuts={vi.fn()}
        />,
      );
    });

    expect(mocks.collapse).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Goodboy' })).toBeNull();
    expect(screen.queryByTestId('goodboy-chip')).toBeNull();
  });
});
