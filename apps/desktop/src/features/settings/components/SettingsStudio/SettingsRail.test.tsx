// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const { invokeSpy, state } = vi.hoisted(() => ({
  invokeSpy: vi.fn(async () => undefined),
  state: {
    updaterStatus: 'idle',
    storageFolders: [],
    settings: {},
    storageStats: null,
    openSecurityFindings: {},
    providers: [],
    cliRequirements: [],
    providerLimits: {},
    projects: [],
    projectGitStatus: {},
    workspaceIntegrations: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
    githubWorkspaceStatus: {} as Record<string, Record<string, unknown>>,
    refreshGithubConnection: vi.fn(async () => undefined),
    githubStatus: null as Record<string, unknown> | null,
  },
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeSpy }));
vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { SettingsRail } from './SettingsRail';

afterEach(() => {
  cleanup();
  invokeSpy.mockClear();
});

describe('SettingsRail', () => {
  it('never invokes a Tauri command just to render', () => {
    render(
      <SettingsRail
        scope="app"
        appSection="general"
        workspaceId={'ws-1' as WorkspaceId}
        workspaceName="Harborline"
        hasWorkspace
        nestedSlot={{ providers: () => undefined, tools: () => undefined }}
        onNestedClosed={() => undefined}
        onSelect={() => undefined}
      />,
    );

    expect(invokeSpy).not.toHaveBeenCalled();
  });
});
