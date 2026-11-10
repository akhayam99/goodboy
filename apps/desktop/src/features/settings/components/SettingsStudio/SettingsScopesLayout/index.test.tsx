// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { studioRailFoldKey } from '@goodboy/ui';
import { QUIET_TOOL_HEALTH } from '../../../../../__tests__/helpers/quietToolHealth';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { settingsDirectory, type SettingsStatus } from '../settingsDirectory';
import { SettingsScopesLayout } from './index';

type ObserverCallback = (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void;

const observers: ObserverCallback[] = [];

const STATUS: SettingsStatus = {
  subtitles: {
    updatesText: undefined,
    updatesTone: undefined,
    storageText: undefined,
    storageTone: undefined,
    securityFindingsText: undefined,
    securityFindingsTone: undefined,
    providersText: undefined,
    providersTone: undefined,
    workspaceText: undefined,
    workspaceTone: undefined,
  },
  providers: [],
  tools: [
    {
      tool: 'linear',
      label: 'Linear',
      subtitle: 'Not connected',
      isConnected: false,
      health: QUIET_TOOL_HEALTH,
    },
  ],
};

const GROUPS = settingsDirectory({ status: STATUS, workspaceName: 'Harborline' });

const FOLD_KEY = studioRailFoldKey({ surface: 'settings' });

type ResizeParams = {
  readonly width: number;
};

const resizeTo = ({ width }: ResizeParams) => {
  act(() => {
    observers.forEach((callback) => callback([{ contentRect: { width } }]));
  });
};

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  observers.length = 0;
  class StubObserver {
    private readonly callback: ObserverCallback;
    constructor(callback: ObserverCallback) {
      this.callback = callback;
    }
    observe() {
      observers.push(this.callback);
    }
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', StubObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const mount = () =>
  render(
    <SettingsScopesLayout
      pageKey="general"
      groups={GROUPS}
      workspaceName="Harborline"
      onScopeChange={() => undefined}
      placement="page"
      detail={<p>detail</p>}
    />,
  );

const rail = () => screen.queryByRole('complementary', { name: 'Settings scopes' });

describe('the Settings scopes rail on a narrow pane', () => {
  it('folds by itself, keeps Show and Search, and saves nothing', () => {
    mount();
    expect(rail()).not.toBeNull();

    resizeTo({ width: 700 });

    expect(rail()).toBeNull();
    screen.getByRole('button', { name: /^Show settings scopes/ });
    screen.getByRole('button', { name: 'Search settings' });
    expect(localStorage.getItem(FOLD_KEY)).toBeNull();
  });

  it('opens on the search field from the folded strip, still saving nothing', () => {
    mount();
    resizeTo({ width: 700 });

    fireEvent.click(screen.getByRole('button', { name: 'Search settings' }));

    expect(rail()).not.toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search settings' }));
    expect(localStorage.getItem(FOLD_KEY)).toBeNull();
  });

  it('docks again once the pane widens', () => {
    mount();
    resizeTo({ width: 700 });
    resizeTo({ width: 1200 });

    expect(rail()).not.toBeNull();
  });
});
