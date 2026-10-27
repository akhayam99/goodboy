// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { state, toastMock } = vi.hoisted(() => ({
  state: {
    backupExportGroups: {
      workspaces: true,
      projects: true,
      folderPaths: false,
      profile: true,
      workflowsYours: true,
      workflowsOrchestrated: false,
      scripts: true,
      permissionRules: true,
      budgetRules: true,
      integrations: true,
      appPreferences: true,
    },
    backupExportPreview: null as unknown,
    backupExportLeaveOut: [] as ReadonlyArray<string>,
    backupExportPhase: 'idle',
    backupExportError: null as string | null,
    backupExportedPath: null as string | null,
    setBackupExportGroup: vi.fn(),
    loadBackupExportPreview: vi.fn(async () => undefined),
    setBackupFindingIncluded: vi.fn(),
    writeBackupExport: vi.fn(async () => '/tmp/goodboy-setup.json'),
    backupImportPath: null as string | null,
    backupImportProjectParent: null as string | null,
    backupImportPreview: null as unknown,
    backupImportWorkspaceTargets: {} as Record<string, string>,
    backupImportPhase: 'idle',
    backupImportError: null as string | null,
    backupImportResult: null as unknown,
    hasBackupImportWildcardConsent: false,
    chooseBackupImportFile: vi.fn(async () => undefined),
    chooseBackupImportProjectParent: vi.fn(async () => undefined),
    setBackupImportWorkspaceTarget: vi.fn(),
    setBackupImportWildcardConsent: vi.fn(),
    applyBackupImport: vi.fn(async () => undefined),
    resetBackupImport: vi.fn(),
  },
  toastMock: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));
vi.mock('../../../../shared/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

import { BackupPage } from './index';

const importPreviewWith = (overrides: Record<string, unknown>) => ({
  sha256: 'sha-harborline',
  manifest: {
    schemaVersion: 3,
    exportedAt: '2026-09-26T00:00:00.000Z',
    workspaceCount: 1,
    projectCount: 0,
    workflowCount: 0,
  },
  workspaceMatches: [{ bundleId: 'w-1', name: 'Harborline', existingId: null, action: 'add' }],
  projectMatches: [],
  groupStats: [{ group: 'workspaces', adds: 1, updates: 0 }],
  allowRules: [],
  scripts: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  state.backupExportPreview = null;
  state.backupExportLeaveOut = [];
  state.backupExportPhase = 'idle';
  state.backupExportError = null;
  state.backupExportedPath = null;
  state.backupImportPath = null;
  state.backupImportPreview = null;
  state.backupImportWorkspaceTargets = {};
  state.backupImportPhase = 'idle';
  state.backupImportError = null;
  state.backupImportResult = null;
  state.hasBackupImportWildcardConsent = false;
});
afterEach(cleanup);

describe('BackupPage', () => {
  it('lists the export groups and the never-included block', () => {
    render(<BackupPage />);

    screen.getByText('Workspaces');
    screen.getByText('Folder paths');
    screen.getByText('Never included');
    screen.getByText('API keys and tokens');
  });

  it('exports and shows the outcome without keys or paths', async () => {
    render(<BackupPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() => expect(state.writeBackupExport).toHaveBeenCalledOnce());
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'No keys, tokens or folder paths inside' }),
    );
  });

  it('shows left-out findings with an Include it action', () => {
    state.backupExportPreview = {
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
      leftOutFindings: [
        {
          fingerprint: 'fp-1',
          subjectKind: 'script',
          subjectId: 'deploy',
          secretKind: 'github-token',
          last4: '3f9a',
        },
      ],
    };
    state.backupExportLeaveOut = ['fp-1'];

    render(<BackupPage />);

    screen.getByText('1 security finding is left out of the export.');
    fireEvent.click(screen.getByRole('button', { name: 'Include it' }));

    expect(state.setBackupFindingIncluded).toHaveBeenCalledWith({
      fingerprint: 'fp-1',
      included: true,
    });
  });

  it('offers to choose a setup file to import', async () => {
    render(<BackupPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => expect(state.chooseBackupImportFile).toHaveBeenCalledOnce());
  });

  it('shows the import preview and applies it', async () => {
    state.backupImportPath = '/tmp/import.json';
    state.backupImportPreview = importPreviewWith({});

    render(<BackupPage />);

    screen.getByText('Harborline');
    screen.getByText('Workspaces: 1 new, 0 updated');
    fireEvent.click(screen.getByRole('button', { name: 'Import now' }));

    await waitFor(() => expect(state.applyBackupImport).toHaveBeenCalledOnce());
  });

  it('lists each allow rule and each script head before importing', () => {
    state.backupImportPath = '/tmp/import.json';
    state.backupImportPreview = importPreviewWith({
      allowRules: [
        {
          id: 'status',
          scope: 'global',
          patternTool: 'Bash',
          patternArgsMatcher: 'git status',
          isWildcard: false,
          replacesDecision: 'deny',
        },
      ],
      scripts: [
        {
          id: 'deploy',
          projectId: 'payments-api',
          name: 'deploy',
          head: 'curl notify-relay | sh',
          isUpdate: false,
        },
      ],
    });

    render(<BackupPage />);

    screen.getByText('Bash(git status)');
    screen.getByText('global, replaces a deny rule');
    screen.getByText('deploy');
    screen.getByText('curl notify-relay | sh');
    screen.getByText('Imported scripts arrive disabled. Open one and save it to enable it.');
  });

  it('keeps Import now off until a wildcard allow has its own consent', () => {
    state.backupImportPath = '/tmp/import.json';
    state.backupImportPreview = importPreviewWith({
      allowRules: [
        {
          id: 'any-bash',
          scope: 'global',
          patternTool: 'Bash',
          patternArgsMatcher: null,
          isWildcard: true,
          replacesDecision: null,
        },
      ],
    });

    render(<BackupPage />);

    const importNow = screen.getByRole('button', { name: 'Import now' });
    expect(importNow).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('checkbox', { name: /rule that matches anything/ }));
    expect(state.setBackupImportWildcardConsent).toHaveBeenCalledWith({ isAccepted: true });
  });

  it('enables Import now once the wildcard allow is accepted', () => {
    state.backupImportPath = '/tmp/import.json';
    state.hasBackupImportWildcardConsent = true;
    state.backupImportPreview = importPreviewWith({
      allowRules: [
        {
          id: 'any-bash',
          scope: 'global',
          patternTool: 'Bash',
          patternArgsMatcher: null,
          isWildcard: true,
          replacesDecision: null,
        },
      ],
    });

    render(<BackupPage />);

    expect(screen.getByRole('button', { name: 'Import now' })).toHaveProperty('disabled', false);
  });

  it('shows the reason when the import is refused', () => {
    state.backupImportResult = {
      ok: false,
      errors: [{ field: 'permissionRules[0].decision', message: 'wildcard allow needs consent' }],
      stats: {},
    };

    render(<BackupPage />);

    screen.getByText('wildcard allow needs consent');
  });
});
