// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    loadSetting: vi.fn(async () => null),
    saveSetting: vi.fn(async () => undefined),
    deleteWorkspace: vi.fn(async () => undefined),
    workspaceOverrides: {} as Record<string, unknown>,
    setWorkspaceOverrides: vi.fn(async () => undefined),
    workspaceIntegrations: {} as Record<string, ReadonlyArray<unknown>>,
    providers: [] as ReadonlyArray<{ id: string; connection: string }>,
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../../features/skills/components/SkillsPanel', () => ({
  SkillsPanel: () => null,
}));

vi.mock('../../../../features/workflows/components/WorkflowsPanel', () => ({
  WorkflowsPanel: () => null,
}));

vi.mock('../../../../features/scripts', () => ({
  ScriptsPanel: () => null,
}));

vi.mock('../../../../features/integrations/linear/ConnectLinearDialog', () => ({
  ConnectLinearDialog: () => null,
}));

vi.mock('../../../../features/session/components/VerbositySelect', () => ({
  VerbositySelect: () => null,
}));

beforeEach(() => {
  state.loadSetting = vi.fn(async () => null);
  state.saveSetting = vi.fn(async () => undefined);
  state.deleteWorkspace = vi.fn(async () => undefined);
  state.workspaceOverrides = {};
  state.setWorkspaceOverrides = vi.fn(async () => undefined);
  state.workspaceIntegrations = {};
});
afterEach(cleanup);

import { WorkspaceSettingsDialog } from './index';

describe('WorkspaceSettingsDialog', () => {
  it('renders the dialog title and the workspace name as description', () => {
    render(
      <WorkspaceSettingsDialog
        workspaceId={'ws-1' as never}
        workspaceName="my repo"
        open
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/workspace settings/i)).toBeDefined();
    expect(screen.getByText('my repo')).toBeDefined();
  });

  it('renders the navigation entries', () => {
    render(
      <WorkspaceSettingsDialog
        workspaceId={'ws-1' as never}
        workspaceName="my repo"
        open
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /^general$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^integrations$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^danger zone$/i })).toBeDefined();
  });
});
