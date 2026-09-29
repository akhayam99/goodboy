import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppStore } from '../../store';
import type { GetFn, SetFn } from '../../slice-types';
import { backupInitialState } from './state';

const h = vi.hoisted(() => ({
  chooseExportFile: vi.fn(async () => '/tmp/goodboy-setup.json'),
  chooseImportFile: vi.fn(async () => '/tmp/import.json'),
  configExportPreview: vi.fn(),
  configExportWrite: vi.fn(async () => undefined),
  configImportPreview: vi.fn(),
  configImportApply: vi.fn(),
  dialogOpen: vi.fn(async (): Promise<string | null> => null),
  listWorkspaces: vi.fn(async () => []),
  listProjectsForWorkspace: vi.fn(async () => []),
}));

vi.mock('../../../features/settings/config-export', () => ({
  chooseExportFile: h.chooseExportFile,
  chooseImportFile: h.chooseImportFile,
  configExportPreview: h.configExportPreview,
  configExportWrite: h.configExportWrite,
  configImportPreview: h.configImportPreview,
  configImportApply: h.configImportApply,
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: h.dialogOpen }));
vi.mock('@goodboy/db', () => ({
  listWorkspaces: h.listWorkspaces,
  listProjectsForWorkspace: h.listProjectsForWorkspace,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import {
  loadBackupExportPreview,
  setBackupExportGroup,
  setBackupFindingIncluded,
  writeBackupExport,
} from './exportActions';
import {
  applyBackupImport,
  chooseBackupImportFile,
  chooseBackupImportProjectParent,
  setBackupImportWorkspaceTarget,
} from './importActions';

const harness = () => {
  let state = {
    ...backupInitialState,
    loadPhaseTemplates: vi.fn(async () => undefined),
    rescanSkills: vi.fn(async () => undefined),
    loadBudgetRules: vi.fn(async () => undefined),
    loadSetting: vi.fn(async () => undefined),
  } as unknown as AppStore;
  const set: SetFn = (update) => {
    const patch = typeof update === 'function' ? update(state) : update;
    state = { ...state, ...patch };
  };
  return {
    get state() {
      return state;
    },
    set,
    get: (() => state) satisfies GetFn,
  };
};

const EMPTY_PREVIEW = {
  counts: {
    workspaces: 0,
    projects: 0,
    skills: 0,
    phaseTemplates: 0,
    permissionRules: 0,
    budgetRules: 0,
    scripts: 0,
    toolBindings: 0,
  },
  leftOutFindings: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.configExportPreview.mockResolvedValue({
    ...EMPTY_PREVIEW,
    leftOutFindings: [
      {
        fingerprint: 'fp-1',
        subjectKind: 'script',
        subjectId: 'deploy',
        secretKind: 'github-token',
        last4: '3f9a',
      },
    ],
  });
  h.chooseExportFile.mockResolvedValue('/tmp/goodboy-setup.json');
  h.chooseImportFile.mockResolvedValue('/tmp/import.json');
  h.configImportPreview.mockResolvedValue({
    manifest: {
      schemaVersion: 3,
      exportedAt: '2026-09-26T00:00:00.000Z',
      workspaceCount: 1,
      projectCount: 1,
      workflowCount: 0,
    },
    workspaceMatches: [{ bundleId: 'w-1', name: 'Harborline', existingId: null, action: 'add' }],
    projectMatches: [],
    groupStats: [{ group: 'workspaces', adds: 1, updates: 0 }],
  });
  h.configImportApply.mockResolvedValue({
    ok: true,
    errors: [],
    stats: {
      workspaces: 1,
      skills: 0,
      phaseTemplates: 0,
      permissionRules: 0,
      budgetRules: 0,
      scripts: 0,
      toolBindings: 0,
      unresolvedProjects: 0,
    },
  });
});

describe('backup export', () => {
  it('loads a preview and leaves every open finding out by default', async () => {
    const store = harness();

    await loadBackupExportPreview(store.set, store.get)();

    expect(store.state.backupExportPreview?.leftOutFindings).toHaveLength(1);
    expect(store.state.backupExportLeaveOut).toEqual(['fp-1']);
  });

  it('reloads the preview when a group toggles', () => {
    const store = harness();

    setBackupExportGroup(store.set, store.get)({ group: 'folderPaths', value: true });

    expect(store.state.backupExportGroups.folderPaths).toBe(true);
    expect(h.configExportPreview).toHaveBeenCalled();
  });

  it('includes a finding back in the export when its fingerprint is un-left-out', async () => {
    const store = harness();
    await loadBackupExportPreview(store.set, store.get)();

    setBackupFindingIncluded(store.set, store.get)({ fingerprint: 'fp-1', included: true });
    expect(store.state.backupExportLeaveOut).toEqual([]);

    setBackupFindingIncluded(store.set, store.get)({ fingerprint: 'fp-1', included: false });
    expect(store.state.backupExportLeaveOut).toEqual(['fp-1']);
  });

  it('writes the export with the current groups and left-out fingerprints', async () => {
    const store = harness();
    await loadBackupExportPreview(store.set, store.get)();

    const path = await writeBackupExport(store.set, store.get)();

    expect(path).toBe('/tmp/goodboy-setup.json');
    expect(h.configExportWrite).toHaveBeenCalledWith({
      path: '/tmp/goodboy-setup.json',
      groups: store.state.backupExportGroups,
      leaveOut: ['fp-1'],
    });
    expect(store.state.backupExportPhase).toBe('done');
  });
});

describe('backup import', () => {
  it('loads a preview after choosing a file', async () => {
    const store = harness();

    await chooseBackupImportFile(store.set, store.get)();

    expect(store.state.backupImportPath).toBe('/tmp/import.json');
    expect(store.state.backupImportPreview?.workspaceMatches).toHaveLength(1);
  });

  it('reloads the preview after picking a project parent folder', async () => {
    const store = harness();
    await chooseBackupImportFile(store.set, store.get)();
    h.dialogOpen.mockResolvedValueOnce('/new/parent');

    await chooseBackupImportProjectParent(store.set, store.get)();

    expect(store.state.backupImportProjectParent).toBe('/new/parent');
    expect(h.configImportPreview).toHaveBeenCalledWith({
      path: '/tmp/import.json',
      projectParent: '/new/parent',
    });
  });

  it('records a workspace merge choice', async () => {
    const store = harness();
    await chooseBackupImportFile(store.set, store.get)();

    setBackupImportWorkspaceTarget(store.set, store.get)({ bundleId: 'w-1', targetId: 'existing' });

    expect(store.state.backupImportWorkspaceTargets).toEqual({ 'w-1': 'existing' });
  });

  it('applies the import and rehydrates workspaces and projects', async () => {
    const store = harness();
    await chooseBackupImportFile(store.set, store.get)();

    await applyBackupImport(store.set, store.get)();

    expect(h.configImportApply).toHaveBeenCalledWith({
      path: '/tmp/import.json',
      workspaceTargets: {},
      resolvedProjectPaths: {},
    });
    expect(store.state.backupImportResult?.ok).toBe(true);
    expect(store.state.backupImportPhase).toBe('done');
    expect(h.listWorkspaces).toHaveBeenCalled();
  });
});

describe('backup error text', () => {
  const rejection = { kind: 'io', message: 'the backup folder is read only' };

  it('shows the message of a structured export preview rejection', async () => {
    const store = harness();
    h.configExportPreview.mockRejectedValueOnce(rejection);

    await loadBackupExportPreview(store.set, store.get)();

    expect(store.state.backupExportPhase).toBe('error');
    expect(store.state.backupExportError).toBe('the backup folder is read only');
  });

  it('shows the message of a structured export write rejection', async () => {
    const store = harness();
    await loadBackupExportPreview(store.set, store.get)();
    h.configExportWrite.mockRejectedValueOnce(rejection);

    const path = await writeBackupExport(store.set, store.get)();

    expect(path).toBeNull();
    expect(store.state.backupExportError).toBe('the backup folder is read only');
  });

  it('shows the message of a structured import preview rejection', async () => {
    const store = harness();
    await chooseBackupImportFile(store.set, store.get)();
    h.dialogOpen.mockResolvedValueOnce('/new/parent');
    h.configImportPreview.mockRejectedValueOnce(rejection);

    await chooseBackupImportProjectParent(store.set, store.get)();

    expect(store.state.backupImportPhase).toBe('error');
    expect(store.state.backupImportError).toBe('the backup folder is read only');
  });

  it('shows the message of a structured import apply rejection', async () => {
    const store = harness();
    await chooseBackupImportFile(store.set, store.get)();
    h.configImportApply.mockRejectedValueOnce(rejection);

    await applyBackupImport(store.set, store.get)();

    expect(store.state.backupImportPhase).toBe('error');
    expect(store.state.backupImportError).toBe('the backup folder is read only');
  });
});
