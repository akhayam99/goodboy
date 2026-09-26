// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SecurityFindingId, WorkspaceId } from '@goodboy/types';

const WORKSPACE_ID = 'ws-1' as WorkspaceId;

const h = vi.hoisted(() => ({
  loadSecurityFindings: vi.fn(async () => undefined),
  dismissSecurityFinding: vi.fn(async () => undefined),
  flagSecurityFindingAgain: vi.fn(async () => undefined),
}));

const storeStateRef = {
  value: {
    openSecurityFindings: {} as Record<string, ReadonlyArray<unknown>>,
    dismissedSecurityFindings: {} as Record<string, ReadonlyArray<unknown>>,
    projectScripts: {} as Record<string, ReadonlyArray<unknown>>,
    projects: [] as ReadonlyArray<{ id: string; name: string }>,
    loadSecurityFindings: h.loadSecurityFindings,
    dismissSecurityFinding: h.dismissSecurityFinding,
    flagSecurityFindingAgain: h.flagSecurityFindingAgain,
  },
};

vi.mock('../../../../store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) => selector(storeStateRef.value),
}));

import { SecurityFindingsSection } from './SecurityFindingsSection';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  storeStateRef.value = {
    ...storeStateRef.value,
    openSecurityFindings: {},
    dismissedSecurityFindings: {},
    projectScripts: {},
    projects: [],
  };
});

describe('SecurityFindingsSection', () => {
  it('asks for a workspace when there is none', () => {
    render(<SecurityFindingsSection workspaceId={null} />);

    expect(screen.getByText('Add a workspace to see this.')).toBeDefined();
    expect(h.loadSecurityFindings).not.toHaveBeenCalled();
  });

  it('loads findings on mount and shows the empty state once ready', async () => {
    render(<SecurityFindingsSection workspaceId={WORKSPACE_ID} />);

    expect(screen.getByText('Checking…')).toBeDefined();
    await waitFor(() => expect(screen.getByText('No findings.')).toBeDefined());
    expect(h.loadSecurityFindings).toHaveBeenCalledWith({ workspaceId: WORKSPACE_ID });
  });

  it('names the script and project when it can resolve them', async () => {
    storeStateRef.value = {
      ...storeStateRef.value,
      openSecurityFindings: {
        [WORKSPACE_ID]: [
          {
            id: 'finding-1' as SecurityFindingId,
            workspaceId: WORKSPACE_ID,
            projectId: 'proj-1',
            subjectKind: 'script',
            subjectId: 'script-1',
            secretKind: 'github-token',
            fingerprint: 'fp-1',
            last4: '3f9a',
            firstSeenAt: new Date().toISOString(),
          },
        ],
      },
      projectScripts: { [WORKSPACE_ID]: [{ id: 'script-1', name: 'deploy' }] },
      projects: [{ id: 'proj-1', name: 'payments-api' }],
    };

    render(<SecurityFindingsSection workspaceId={WORKSPACE_ID} />);

    await waitFor(() =>
      expect(
        screen.getByText(
          '1 saved script looks like it contains a token: "deploy" in payments-api.',
        ),
      ).toBeDefined(),
    );
  });

  it('dismisses a finding as not a secret through an inline confirm', async () => {
    storeStateRef.value = {
      ...storeStateRef.value,
      openSecurityFindings: {
        [WORKSPACE_ID]: [
          {
            id: 'finding-1' as SecurityFindingId,
            workspaceId: WORKSPACE_ID,
            subjectKind: 'permission-rule',
            subjectId: 'rule-1',
            secretKind: 'aws-access-key',
            fingerprint: 'fp-2',
            last4: 'aaaa',
            firstSeenAt: new Date().toISOString(),
          },
        ],
      },
    };

    render(<SecurityFindingsSection workspaceId={WORKSPACE_ID} />);
    await waitFor(() => expect(screen.getByText('Not a secret')).toBeDefined());

    fireEvent.click(screen.getByText('Not a secret'));
    fireEvent.click(screen.getByText('Not a secret'));

    await waitFor(() =>
      expect(h.dismissSecurityFinding).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        findingId: 'finding-1',
      }),
    );
  });

  it('flags a dismissed finding again from the collapsed group', () => {
    storeStateRef.value = {
      ...storeStateRef.value,
      dismissedSecurityFindings: {
        [WORKSPACE_ID]: [
          {
            id: 'finding-2' as SecurityFindingId,
            workspaceId: WORKSPACE_ID,
            subjectKind: 'script',
            subjectId: 'script-2',
            secretKind: 'openai-key',
            fingerprint: 'fp-3',
            last4: '1234',
            firstSeenAt: new Date().toISOString(),
          },
        ],
      },
    };

    render(<SecurityFindingsSection workspaceId={WORKSPACE_ID} />);
    fireEvent.click(screen.getByText('Dismissed 1'));
    fireEvent.click(screen.getByText('Flag again'));

    expect(h.flagSecurityFindingAgain).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      findingId: 'finding-2',
    });
  });
});
