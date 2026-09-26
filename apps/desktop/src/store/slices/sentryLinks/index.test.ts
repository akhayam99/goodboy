import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId, ProjectSentryLink, WorkspaceId } from '@goodboy/types';

const { listSpy, addSpy, removeSpy } = vi.hoisted(() => ({
  listSpy: vi.fn(),
  addSpy: vi.fn(),
  removeSpy: vi.fn(),
}));

vi.mock('@goodboy/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/db')>();
  return {
    ...actual,
    listProjectSentryLinks: listSpy,
    addProjectSentryLink: addSpy,
    removeProjectSentryLink: removeSpy,
  };
});

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { createSentryLinksSlice } from './index';

const WORKSPACE = 'ws-harborline' as WorkspaceId;
const PAYMENTS = 'payments' as ProjectId;

const harness = () => {
  let state: Record<string, unknown> = {};
  const set = (
    patch: Record<string, unknown> | ((s: Record<string, unknown>) => Record<string, unknown>),
  ) => {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  };
  const get = () => state;
  const slice = createSentryLinksSlice(set as never, get as never);
  state = { ...slice };
  return { slice, read: () => state };
};

const stored = { id: 'link-1', projectId: PAYMENTS, sentryProject: 'payments-api' };

beforeEach(() => {
  listSpy.mockReset();
  addSpy.mockReset();
  removeSpy.mockReset();
  listSpy.mockResolvedValue([stored]);
});

describe('sentryLinks slice', () => {
  it('loads the links of a workspace', async () => {
    const { slice, read } = harness();

    await slice.loadProjectSentryLinks({ workspaceId: WORKSPACE });

    expect(read().projectSentryLinks).toEqual({ [WORKSPACE]: [stored] });
  });

  it('saves a link, then reloads the workspace', async () => {
    const { slice, read } = harness();

    await slice.linkSentryProject({
      workspaceId: WORKSPACE,
      projectId: PAYMENTS,
      sentryOrg: 'northwind',
      sentryProject: 'payments-api',
      sentryProjectName: 'payments-api',
      source: 'code_mapping',
    });

    const saved = addSpy.mock.calls[0]?.[0] as { link: ProjectSentryLink };
    expect(saved.link).toMatchObject({
      workspaceId: WORKSPACE,
      projectId: PAYMENTS,
      sentryProject: 'payments-api',
      source: 'code_mapping',
    });
    expect(read().projectSentryLinks).toEqual({ [WORKSPACE]: [stored] });
  });

  it('removes one link by project and sentry project', async () => {
    listSpy.mockResolvedValue([]);
    const { slice, read } = harness();

    await slice.unlinkSentryProject({
      workspaceId: WORKSPACE,
      projectId: PAYMENTS,
      sentryOrg: 'northwind',
      sentryProject: 'payments-api',
    });

    expect(removeSpy).toHaveBeenCalledWith({
      db: {},
      projectId: PAYMENTS,
      sentryOrg: 'northwind',
      sentryProject: 'payments-api',
    });
    expect(read().projectSentryLinks).toEqual({ [WORKSPACE]: [] });
  });
});
