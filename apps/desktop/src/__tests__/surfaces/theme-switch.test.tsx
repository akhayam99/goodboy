// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Profiler, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { seedSessionWithMounts } from '../helpers/seedSessionWithMounts';
import { ToastProvider } from '../../shared/components/Toast';
import { KeepAliveWorkSurface } from '../../app/components/KeepAliveWorkSurface';
import { ThemeSwitchProbe } from '../helpers/ThemeSwitchProbe';
import { WORKSPACE_ID, seedBoardScene } from '../../app/components/MockScene/scenes/BoardScene';
import {
  SETTINGS_WORKSPACE,
  seedSettingsBase,
} from '../../app/components/MockScene/scenes/audit/settingsSeed';
import { StageBoard } from '../../features/workspace/components/StageBoard';
import { SettingsStudio } from '../../features/settings/components/SettingsStudio';
import { useThemeStore } from '../../shared/lib/theme';

let useAppStore: StoryStore;

const resetTheme = (): void => {
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  root.removeAttribute('data-theme-switching');
  root.classList.remove('light', 'dark');
  root.style.removeProperty('color-scheme');
  Reflect.deleteProperty(document, 'startViewTransition');
  useThemeStore.setState({ preference: 'dark' });
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetTheme();
});

afterEach(() => {
  cleanup();
  resetTheme();
});

const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

type Counts = { tree: number; toggle: number };

const mountMeasured = async ({ tree }: { readonly tree: ReactNode }): Promise<Counts> => {
  const counts: Counts = { tree: 0, toggle: 0 };
  render(
    <ToastProvider>
      <Profiler id="toggle" onRender={() => (counts.toggle += 1)}>
        <ThemeSwitchProbe />
      </Profiler>
      <div data-testid="measured">
        <Profiler id="tree" onRender={() => (counts.tree += 1)}>
          {tree}
        </Profiler>
      </div>
    </ToastProvider>,
  );
  await flush();
  await flush();
  await flush();
  counts.tree = 0;
  counts.toggle = 0;
  return counts;
};

const toggleThreeTimes = async (): Promise<void> => {
  for (const expected of ['light', 'dark', 'light'] as const) {
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Switch to/ }));
    });
    expect(document.documentElement.classList.contains(expected)).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe(expected);
    expect(document.documentElement.hasAttribute('data-theme-switching')).toBe(true);
    await flush();
    await waitFor(() => {
      expect(document.documentElement.hasAttribute('data-theme-switching')).toBe(false);
    });
  }
};

describe('theme switch is a class swap on the html element', () => {
  it('re-renders nothing on the session detail page', async () => {
    const sessionId = seedSessionWithMounts({ useAppStore });
    const counts = await mountMeasured({
      tree: <KeepAliveWorkSurface sessionId={sessionId} isActive />,
    });
    const surface = screen.getByTestId('measured');
    const newControl = screen.getByRole('button', { name: 'New' });
    const textBefore = surface.textContent;
    const changed: Array<Node> = [];
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        changed.push(...Array.from(record.removedNodes), ...Array.from(record.addedNodes));
      });
    });
    observer.observe(surface, { childList: true, subtree: true });

    await toggleThreeTimes();
    observer.disconnect();

    expect(counts).toEqual({ tree: 0, toggle: 3 });
    expect(changed).toEqual([]);
    expect(screen.getByRole('button', { name: 'New' })).toBe(newControl);
    expect(surface.textContent).toBe(textBefore);
  });

  it('commits each switch once and never defers the swap to a view transition', async () => {
    const startViewTransition = vi.fn((update: () => void) => {
      window.setTimeout(update, 0);
      return {
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        finished: Promise.resolve(),
        skipTransition: () => undefined,
      };
    });
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      writable: true,
      value: startViewTransition,
    });
    const sessionId = seedSessionWithMounts({ useAppStore });
    const counts = await mountMeasured({
      tree: <KeepAliveWorkSurface sessionId={sessionId} isActive />,
    });

    await toggleThreeTimes();

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(counts).toEqual({ tree: 0, toggle: 3 });
  });

  it('re-renders nothing on the board', async () => {
    seedBoardScene();
    const sessions = useAppStore.getState().sessions;
    const counts = await mountMeasured({
      tree: <StageBoard workspaceId={WORKSPACE_ID} sessions={sessions} />,
    });

    await toggleThreeTimes();

    expect(counts).toEqual({ tree: 0, toggle: 3 });
  });

  it('re-renders nothing in workspace settings', async () => {
    seedSettingsBase();
    const counts = await mountMeasured({
      tree: (
        <SettingsStudio
          currentWorkspace={SETTINGS_WORKSPACE}
          focus={{ scope: 'workspace' }}
          onScopeChange={() => undefined}
          onClose={() => undefined}
        />
      ),
    });

    await toggleThreeTimes();

    expect(counts).toEqual({ tree: 0, toggle: 3 });
  });

  it('changes only the theme field in app settings, which shows the choice', async () => {
    seedSettingsBase();
    const counts = await mountMeasured({
      tree: (
        <SettingsStudio
          currentWorkspace={SETTINGS_WORKSPACE}
          focus={{ scope: 'app' }}
          onScopeChange={() => undefined}
          onClose={() => undefined}
        />
      ),
    });
    const surface = screen.getByTestId('measured');
    const field = screen.getByRole('tablist', { name: 'Theme' });
    const outside: Array<Node> = [];
    const observer = new MutationObserver((records) => {
      records
        .filter((record) => !field.contains(record.target))
        .forEach((record) => outside.push(record.target));
    });
    observer.observe(surface, { childList: true, subtree: true, characterData: true });

    await toggleThreeTimes();
    observer.disconnect();

    expect(counts.toggle).toBe(3);
    expect(outside).toEqual([]);
    expect(field.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim()).toBe(
      'Light',
    );
  });
});
