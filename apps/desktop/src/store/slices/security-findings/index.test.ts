import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId, SecurityFindingId, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  recordSecurityFindings: vi.fn(),
  listOpenSecurityFindings: vi.fn(async () => [] as ReadonlyArray<unknown>),
  listDismissedSecurityFindings: vi.fn(async () => [] as ReadonlyArray<unknown>),
  dismissSecurityFinding: vi.fn(),
  flagSecurityFindingAgain: vi.fn(),
  scanTextForSecrets: vi.fn(async () => [] as ReadonlyArray<unknown>),
}));

vi.mock('@goodboy/db', () => ({
  recordSecurityFindings: h.recordSecurityFindings,
  listOpenSecurityFindings: h.listOpenSecurityFindings,
  listDismissedSecurityFindings: h.listDismissedSecurityFindings,
  dismissSecurityFinding: h.dismissSecurityFinding,
  flagSecurityFindingAgain: h.flagSecurityFindingAgain,
}));
vi.mock('@goodboy/core', () => ({ scanTextForSecrets: h.scanTextForSecrets }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { dismissSecurityFinding } from './dismissSecurityFinding';
import { flagSecurityFindingAgain } from './flagSecurityFindingAgain';
import { loadSecurityFindings } from './loadSecurityFindings';
import { recordScanFindings } from './recordScanFindings';
import { securityFindingsInitialState } from './state';

const WORKSPACE_ID = 'ws-harborline' as WorkspaceId;
const FINDING_ID = 'finding-1' as SecurityFindingId;
const PROJECT_ID = 'proj-ledger' as ProjectId;

const makeStore = () => {
  const store = { state: { ...securityFindingsInitialState } as unknown as AppStore };
  const set: SetFn = (partial) => {
    const next = typeof partial === 'function' ? partial(store.state) : partial;
    store.state = { ...store.state, ...next };
  };
  const get: GetFn = () => store.state;
  return { store, set, get };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadSecurityFindings', () => {
  it('loads the open and dismissed lists for a workspace', async () => {
    h.listOpenSecurityFindings.mockResolvedValue([{ id: FINDING_ID }]);
    h.listDismissedSecurityFindings.mockResolvedValue([]);
    const { store, set } = makeStore();

    await loadSecurityFindings(set)({ workspaceId: WORKSPACE_ID });

    expect(store.state.openSecurityFindings[WORKSPACE_ID]).toEqual([{ id: FINDING_ID }]);
    expect(store.state.dismissedSecurityFindings[WORKSPACE_ID]).toEqual([]);
  });
});

describe('dismissSecurityFinding', () => {
  it('persists the dismissal and reloads the lists', async () => {
    const { store, set, get } = makeStore();
    store.state = { ...store.state, loadSecurityFindings: loadSecurityFindings(set) };

    await dismissSecurityFinding(get)({ workspaceId: WORKSPACE_ID, findingId: FINDING_ID });

    expect(h.dismissSecurityFinding).toHaveBeenCalledWith(
      expect.objectContaining({ findingId: FINDING_ID }),
    );
    expect(h.listOpenSecurityFindings).toHaveBeenCalled();
  });
});

describe('flagSecurityFindingAgain', () => {
  it('clears the dismissal and reloads the lists', async () => {
    const { store, set, get } = makeStore();
    store.state = { ...store.state, loadSecurityFindings: loadSecurityFindings(set) };

    await flagSecurityFindingAgain(get)({ workspaceId: WORKSPACE_ID, findingId: FINDING_ID });

    expect(h.flagSecurityFindingAgain).toHaveBeenCalledWith(
      expect.objectContaining({ findingId: FINDING_ID }),
    );
    expect(h.listOpenSecurityFindings).toHaveBeenCalled();
  });
});

describe('recordScanFindings', () => {
  it('scans the text and records what it finds', async () => {
    h.scanTextForSecrets.mockResolvedValue([
      { secretKind: 'github-token', fingerprint: 'fp-1', last4: '3f9a' },
    ]);
    const { get } = makeStore();

    await recordScanFindings(get)({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      subjectKind: 'script',
      subjectId: 'script-1',
      text: 'DEPLOY_TOKEN=ghp_abcdefghijklmnopqrstuvwxyzabcdefgh',
    });

    expect(h.recordSecurityFindings).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        projectId: PROJECT_ID,
        subjectKind: 'script',
        subjectId: 'script-1',
        findings: [{ secretKind: 'github-token', fingerprint: 'fp-1', last4: '3f9a' }],
      }),
    );
  });

  it('does not reload a workspace whose findings were never loaded', async () => {
    const { get } = makeStore();

    await recordScanFindings(get)({
      workspaceId: WORKSPACE_ID,
      projectId: null,
      subjectKind: 'script',
      subjectId: 'script-1',
      text: 'nothing to see here',
    });

    expect(h.listOpenSecurityFindings).not.toHaveBeenCalled();
  });
});
