// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { OnboardingStepId } from '../../../../features/onboarding/onboarding-store';

const { mocks } = vi.hoisted(() => ({
  mocks: {
    store: {
      updaterStatus: 'idle' as 'idle' | 'available' | 'downloading',
      updateVersion: '0.5.2' as string | null,
      updateFailure: null,
      installUpdate: vi.fn(async () => undefined),
    },
    progress: {
      completedCount: 3,
      totalCount: 7,
      completed: new Set<OnboardingStepId>(['workspace', 'codeHost', 'tools']),
      collapsed: true,
      finished: false,
      isDone: false,
      hasProjects: true,
    },
    hasDraft: false,
    collapse: vi.fn(),
    finish: vi.fn(),
    openUrl: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof mocks.store) => T) => selector(mocks.store),
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

vi.mock('../../../../features/changelog/hooks/useInstalledVersion', () => ({
  useInstalledVersion: () => '0.5.2',
}));

vi.mock('../../../../features/settings/hooks/useHasBugReportDraft', () => ({
  useHasBugReportDraft: () => mocks.hasDraft,
}));

vi.mock('../../../../features/settings/components/ReportIssueForm', () => ({
  ReportIssueForm: ({ onOpenFullForm }: { readonly onOpenFullForm: () => void }) => (
    <button type="button" onClick={onOpenFullForm}>
      Add details and send
    </button>
  ),
}));

vi.mock('../../../../features/updater/hooks/useRunningAgentCount', () => ({
  useRunningAgentCount: () => 0,
}));

vi.mock('../../../../shared/lib/editor', () => ({
  openUrl: mocks.openUrl,
}));

import { GoodboyChip, SPONSOR_URL } from './index';

const REST_LABEL = 'Goodboy beta: version, help and sponsor';

beforeEach(() => {
  mocks.store.updaterStatus = 'idle';
  mocks.progress.collapsed = true;
  mocks.progress.finished = false;
  mocks.progress.isDone = false;
  mocks.progress.hasProjects = true;
  mocks.hasDraft = false;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
  it('names Goodboy beta at rest', () => {
    mocks.progress.finished = true;
    renderChip();

    const chip = screen.getByRole('button', { name: REST_LABEL });
    expect(chip.textContent).toBe('Goodboybeta');
  });

  it('says setup and its progress while setup is open', () => {
    renderChip();

    const chip = screen.getByRole('button', { name: 'Goodboy: setup is not finished' });
    expect(chip.textContent).toBe('Setup3 of 7');
  });

  it('puts a ready update ahead of setup', () => {
    mocks.store.updaterStatus = 'available';
    renderChip();

    const chip = screen.getByRole('button', { name: 'Goodboy: an update is ready' });
    expect(chip.textContent).toBe('Update ready');
    expect(within(openMenu()).getByRole('button', { name: 'Restart to update' })).toBeDefined();
  });

  it('holds the version, setup and every product place in one popover', () => {
    renderChip();

    const menu = openMenu();

    expect(within(menu).getByText('Goodboy 0.5.2')).toBeDefined();
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

  it('swaps in the bug report form, says a draft is saved, and comes back', () => {
    mocks.hasDraft = true;
    renderChip();

    const menu = openMenu();
    expect(within(menu).getByText('Draft saved')).toBeDefined();
    fireEvent.click(within(menu).getByText('Report a bug'));

    expect(screen.getByRole('button', { name: 'Add details and send' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText("What's new")).toBeDefined();

    fireEvent.click(screen.getByText('Report a bug'));
    fireEvent.click(screen.getByRole('button', { name: 'Add details and send' }));
    expect(screen.queryByRole('dialog', { name: 'Goodboy' })).toBeNull();
  });

  it('opens itself once when the first project arrives, then remembers it did', async () => {
    mocks.progress.collapsed = false;
    await act(async () => {
      renderChip();
    });

    expect(mocks.collapse).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog', { name: 'Goodboy' })).toBeDefined();
  });

  it('never opens itself before a project exists or after setup is done with', async () => {
    mocks.progress.collapsed = false;
    mocks.progress.hasProjects = false;
    await act(async () => {
      renderChip();
    });

    expect(mocks.collapse).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Goodboy' })).toBeNull();
  });
});
