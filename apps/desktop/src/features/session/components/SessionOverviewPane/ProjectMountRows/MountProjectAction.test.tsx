// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId, WorkspaceId } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    projects: [] as ReadonlyArray<Record<string, unknown>>,
    bootstrapPhase: {},
    sessionProjectMounts: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
    ensureProjectMounted: vi.fn(async () => undefined),
    emitNotification: vi.fn(),
  },
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

import { MountProjectAction } from './MountProjectAction';

const typedString = <Value extends string>({ value }: { readonly value: string }): Value =>
  JSON.parse(JSON.stringify(value));

const SESSION_ID = typedString<SessionId>({ value: 'session-1' });
const WORKSPACE_ID = typedString<WorkspaceId>({ value: 'workspace-1' });

const project = ({ id, name }: { readonly id: string; readonly name: string }) => ({
  id,
  workspaceId: WORKSPACE_ID,
  name,
  kind: 'repo',
  rootPath: `/repo/${id}`,
});

const openPicker = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Add folder' }));
};

describe('MountProjectAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.projects = [];
    store.sessionProjectMounts = {};
  });
  afterEach(cleanup);

  it('renders a single labelled action regardless of mount state', () => {
    render(
      <MountProjectAction
        sessionId={SESSION_ID}
        workspaceId={WORKSPACE_ID}
        presentation="button"
      />,
    );

    expect(screen.getByRole('button', { name: 'Add folder' })).toBeDefined();
  });

  it('tells the workspace has no projects and offers to connect one in the same picker', () => {
    store.projects = [];
    render(
      <MountProjectAction
        sessionId={SESSION_ID}
        workspaceId={WORKSPACE_ID}
        presentation="button"
      />,
    );
    openPicker();

    expect(screen.getByText('This workspace has no folder yet.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Connect a repo or folder' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add workspace project' })).toBeNull();
  });

  it('says every project is already in and still offers to connect a new one', () => {
    store.projects = [project({ id: 'api', name: 'API' })];
    store.sessionProjectMounts = {
      'session-1': [{ mountId: 'mount-1', projectId: 'api' }],
    };
    render(
      <MountProjectAction
        sessionId={SESSION_ID}
        workspaceId={WORKSPACE_ID}
        presentation="button"
      />,
    );

    openPicker();
    expect(screen.queryByRole('button', { name: 'Project actions' })).toBeNull();
    expect(screen.getByText('Every workspace folder is already in this session.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Connect a repo or folder' })).toBeDefined();
  });

  it('lists an unmounted project for mounting', () => {
    store.projects = [project({ id: 'api', name: 'API' })];
    render(
      <MountProjectAction
        sessionId={SESSION_ID}
        workspaceId={WORKSPACE_ID}
        presentation="button"
      />,
    );
    openPicker();

    expect(screen.getByRole('button', { name: 'Add API' })).toBeDefined();
  });

  it('puts starred projects at the top of the picker', () => {
    store.projects = [
      project({ id: 'relay', name: 'notify-relay' }),
      { ...project({ id: 'ledger', name: 'ledger-core' }), starredAt: '2026-09-25T09:00:00.000Z' },
    ];
    render(
      <MountProjectAction
        sessionId={SESSION_ID}
        workspaceId={WORKSPACE_ID}
        presentation="button"
      />,
    );
    openPicker();

    expect(
      screen
        .getAllByRole('button', { name: /^Add (ledger-core|notify-relay)$/ })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Add ledger-core', 'Add notify-relay']);
  });
});
