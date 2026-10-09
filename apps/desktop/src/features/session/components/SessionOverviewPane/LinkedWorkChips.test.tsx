// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type {
  IsoDateTime,
  ProjectId,
  SessionExternalTask,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';

let useAppStore: StoryStore;
let LinkedWorkChips: typeof import('./LinkedWorkChips').LinkedWorkChips;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ LinkedWorkChips } = await import('./LinkedWorkChips'));
}, STORE_IMPORT_TIMEOUT_MS);

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const NOW = '2026-09-28T09:00:00.000Z' as IsoDateTime;
const session = aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID });

type TaskParams = {
  readonly identifier: string;
  readonly scope: 'session' | 'branch';
  readonly branch?: string;
};

const taskOf = ({ identifier, scope, branch }: TaskParams): SessionExternalTask => ({
  sessionId: SESSION_ID,
  projectId: 'ledger' as ProjectId,
  scope,
  ...(branch === undefined ? {} : { branch }),
  provider: 'linear',
  externalId: `ext-${identifier}`,
  identifier,
  url: `https://linear.example/${identifier}`,
  title: `Task ${identifier}`,
  createdAt: NOW,
});

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ sessions: [session] });
});

afterEach(cleanup);

describe('LinkedWorkChips', () => {
  it('shows the tasks linked to the session and none that live only on a branch', () => {
    useAppStore.setState({
      sessionExternalTasks: {
        [SESSION_ID]: [
          taskOf({ identifier: 'NW-41', scope: 'session' }),
          taskOf({ identifier: 'NW-42', scope: 'branch', branch: 'hl/retry' }),
        ],
      },
    });
    render(<LinkedWorkChips sessionId={SESSION_ID} onSelectLens={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Open NW-41/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Open NW-42/ })).toBeNull();
  });

  it('keeps a session task that is also on a branch as one chip', () => {
    useAppStore.setState({
      sessionExternalTasks: {
        [SESSION_ID]: [
          taskOf({ identifier: 'NW-41', scope: 'session' }),
          taskOf({ identifier: 'NW-41', scope: 'branch', branch: 'hl/retry' }),
        ],
      },
    });
    render(<LinkedWorkChips sessionId={SESSION_ID} onSelectLens={vi.fn()} />);

    expect(screen.getAllByRole('button', { name: /Open NW-41/ })).toHaveLength(1);
  });

  it('renders nothing while the only tasks are branch tasks', () => {
    useAppStore.setState({
      sessionExternalTasks: {
        [SESSION_ID]: [taskOf({ identifier: 'NW-42', scope: 'branch', branch: 'hl/retry' })],
      },
    });
    render(<LinkedWorkChips sessionId={SESSION_ID} onSelectLens={vi.fn()} />);

    expect(screen.queryByLabelText('Linked work')).toBeNull();
  });
});
