// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    readSearchIndexStatus: async () => ({
      docs: 0,
      bytes: 0,
      scanned: 0,
      total: 0,
      isBackfillDone: true,
      excludedProjectIds: [],
    }),
  }),
);
vi.mock('./AppScopePanel', () => ({ AppScopePanel: () => <p>App page</p> }));
vi.mock('./WorkspaceScopePanel', () => ({ WorkspaceScopePanel: () => <p>Workspace page</p> }));
vi.mock('../../../providers/components/ProviderStudio/ProviderPage', () => ({
  ProviderPage: () => <p>Provider page</p>,
}));
vi.mock('../../../providers/components/ProviderStudio/DefaultsPanel', () => ({
  DefaultsPanel: () => <p>Defaults page</p>,
}));
vi.mock('../../../integrations/components/ToolSettingsScope/ToolDetailPanel', () => ({
  ToolDetailPanel: () => <p>Tool page</p>,
}));

import { Profiler } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Workspace } from '@goodboy/types';
import { aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { settingsOverlayFromEvent } from '../../../../app/hooks/useAppOverlays/eventDetail';
import type { SettingsFocus, SettingsScopeChange } from '../../settingsFocus';
import type { ProviderDisplayInfo } from '../../../providers/providers';
import { ToastProvider } from '../../../../shared/components/Toast';
import { SettingsStudio } from './index';

let useAppStore: StoryStore;

const WORKSPACE: Workspace = aWorkspace({ name: 'Harborline' });

const CAPABILITIES = {
  models: [],
  supportsTools: true,
  supportsStream: true,
  supportsCheapModel: true,
};

const CONNECTED_PROVIDERS: ReadonlyArray<ProviderDisplayInfo> = [
  {
    id: 'anthropic',
    binary: 'claude',
    capabilities: CAPABILITIES,
    connection: 'connected',
    version: '9.9.9',
    identity: 'harborline-platform',
    label: 'Claude',
    error: null,
    docsUrl: 'https://docs.claude.com',
  },
  {
    id: 'codex',
    binary: 'codex',
    capabilities: CAPABILITIES,
    connection: 'missing',
    version: null,
    identity: null,
    label: 'Codex',
    error: null,
    docsUrl: 'https://github.com/openai/codex',
  },
];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ detect_editors: [] });
});

afterEach(() => {
  cleanup();
});

const focusOf = (): SettingsFocus => {
  const studio = useAppStore.getState().appStudio;
  return studio?.kind === 'settings' ? studio.focus : { scope: 'home' };
};

const changeScope = (change: SettingsScopeChange) =>
  useAppStore.getState().amendStudio({ studio: { kind: 'settings', focus: change } });

const StoreStudio = ({ workspace }: { readonly workspace: Workspace | null }) => {
  const focus = useAppStore((state) =>
    state.appStudio?.kind === 'settings' ? state.appStudio.focus : null,
  );
  if (focus === null) {
    return null;
  }
  return (
    <ToastProvider>
      <SettingsStudio
        currentWorkspace={workspace}
        focus={focus}
        onScopeChange={changeScope}
        onClose={() => undefined}
      />
    </ToastProvider>
  );
};

const openHome = ({ workspace }: { readonly workspace: Workspace | null }) => {
  useAppStore.getState().openStudio({ studio: { kind: 'settings', focus: { scope: 'home' } } });
  return render(<StoreStudio workspace={workspace} />);
};

const home = () => screen.getByRole('heading', { name: 'Settings' });

const cardKeys = (): ReadonlyArray<string> =>
  Array.from(document.querySelectorAll('[data-settings-page]'))
    .filter((element) => element.tagName === 'BUTTON')
    .map((element) => element.getAttribute('data-settings-page') ?? '');

const cardOf = (key: string): HTMLElement => {
  const card = document.querySelector<HTMLElement>(`button[data-settings-page="${key}"]`);
  if (card === null) {
    throw new Error(`no card ${key}`);
  }
  return card;
};

const labelOf = (card: HTMLElement): string =>
  card.querySelector('[data-settings-label]')?.textContent ?? '';

describe('SettingsHome', () => {
  it('opens on the home with one titled group per rail group', () => {
    openHome({ workspace: WORKSPACE });

    home();
    expect(screen.queryByRole('navigation', { name: 'Settings scopes' })).toBeNull();
    ['App', 'Workspace', 'Providers & models', 'Integrations'].forEach((group) =>
      screen.getByRole('region', { name: group }),
    );
  });

  it('leaves the workspace groups out without a workspace', () => {
    openHome({ workspace: null });

    screen.getByRole('region', { name: 'App' });
    screen.getByRole('region', { name: 'Providers & models' });
    expect(screen.queryByRole('region', { name: 'Workspace' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Integrations' })).toBeNull();
  });

  it('opens each card on the page whose rail item is current, and the crumb comes back', async () => {
    useAppStore.setState({
      providers: CONNECTED_PROVIDERS,
      refreshProviders: async () => undefined,
    });
    openHome({ workspace: WORKSPACE });
    const keys = cardKeys();
    expect(keys.length).toBeGreaterThan(15);

    for (const key of keys) {
      const card = cardOf(key);
      const label = labelOf(card);
      fireEvent.click(card);

      await waitFor(() => {
        const rail = screen.getByRole('navigation', { name: 'Settings scopes' });
        const current = within(rail)
          .getAllByRole('button')
          .filter((button) => button.getAttribute('aria-current') === 'true');
        expect(current.map((button) => button.textContent ?? '').join()).toContain(label);
      });

      const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
      fireEvent.click(within(trail).getByRole('button', { name: 'Settings' }));
      home();
    }
  });

  it('marks the page opened last and gives it the focus', () => {
    openHome({ workspace: WORKSPACE });
    fireEvent.click(cardOf('app:backup'));
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('button', {
        name: 'Settings',
      }),
    );

    const backup = cardOf('app:backup');
    expect(backup.textContent).toContain('Last opened');
    expect(document.activeElement).toBe(backup);
    expect(cardOf('app:general').textContent).not.toContain('Last opened');
  });

  it('starts no storage, branch or provider loading on the home', () => {
    const loadStorage = vi.fn(async () => undefined);
    const refreshProviders = vi.fn(async () => undefined);
    useAppStore.setState({ loadStorage, refreshProviders });

    openHome({ workspace: WORKSPACE });

    expect(loadStorage).not.toHaveBeenCalled();
    expect(refreshProviders).not.toHaveBeenCalled();
    const commands = storySpies.tauriInvoke.mock.calls.map(([command]) => String(command));
    expect(commands.filter((command) => command.includes('branch'))).toEqual([]);
  });

  it('does not render again when a store key it does not read changes', () => {
    let commits = 0;
    useAppStore.getState().openStudio({ studio: { kind: 'settings', focus: { scope: 'home' } } });
    render(
      <Profiler id="settings-home" onRender={() => (commits += 1)}>
        <StoreStudio workspace={WORKSPACE} />
      </Profiler>,
    );
    const settled = commits;

    act(() => {
      Array.from({ length: 20 }).forEach(() => useAppStore.setState({ agentTurnState: {} }));
    });

    expect(commits).toBe(settled);
  });
});

describe('settings links', () => {
  it('skip the home when they name a page and land on it otherwise', () => {
    const direct = settingsOverlayFromEvent(
      new CustomEvent('goodboy:open-settings', { detail: { scope: 'app', section: 'storage' } }),
    );
    const bare = settingsOverlayFromEvent(new CustomEvent('goodboy:open-settings'));

    expect(direct).toEqual(
      expect.objectContaining({
        focus: expect.objectContaining({ scope: 'app', section: 'storage' }),
      }),
    );
    expect(bare).toEqual(
      expect.objectContaining({ focus: expect.objectContaining({ scope: 'home' }) }),
    );
  });

  it('keeps the focus of the store in step with the card that was clicked', () => {
    openHome({ workspace: WORKSPACE });
    fireEvent.click(cardOf('tool:linear'));

    expect(focusOf()).toEqual({ scope: 'tools', tool: 'linear' });
  });
});
