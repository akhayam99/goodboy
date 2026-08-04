import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type {
  IsoDateTime,
  SessionExternalTask,
  SessionExternalTaskProvider,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';

vi.mock('../../../../../../shared/lib/editor', () => ({
  openUrl: vi.fn(),
}));

vi.mock('../../../../../../store/slices/worktrees/useSessionRepo', () => ({
  useSessionRepo: () => ({ repoRoot: '/repo' }),
}));

vi.mock('./LinearTaskDetail', () => ({
  LinearTaskDetail: () => <div>Linear detail</div>,
}));

vi.mock('./SentryTaskDetail', () => ({
  SentryTaskDetail: () => <div>Sentry detail</div>,
}));

vi.mock('./GithubTaskDetail', () => ({
  GithubTaskDetail: () => <div>Github detail</div>,
}));

vi.mock('./GitlabTaskDetail', () => ({
  GitlabTaskDetail: () => <div>Gitlab detail</div>,
}));

import { FocusedTaskBody } from './FocusedTaskBody';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const SESSION_ID = 'session-1' as SessionId;

const makeTask = (provider: SessionExternalTaskProvider): SessionExternalTask => ({
  sessionId: SESSION_ID,
  provider,
  externalId: '42',
  identifier: '#42',
  title: 'Some issue',
  url: 'https://example.com/42',
  createdAt: '2026-07-22T12:00:00.000Z' as IsoDateTime,
});

afterEach(cleanup);

describe('FocusedTaskBody', () => {
  it.each([
    ['github', 'Github detail'],
    ['gitlab', 'Gitlab detail'],
  ] as const)('dispatches a connected %s task to its detail component', (provider, text) => {
    render(
      <FocusedTaskBody
        provider={provider}
        sessionId={SESSION_ID}
        workspaceId={WORKSPACE_ID}
        task={makeTask(provider)}
        isConnected
      />,
    );

    expect(screen.getByText(text)).toBeDefined();
  });

  it.each(['github', 'gitlab'] as const)(
    'falls back to the external chip for a disconnected %s task',
    (provider) => {
      render(
        <FocusedTaskBody
          provider={provider}
          sessionId={SESSION_ID}
          workspaceId={WORKSPACE_ID}
          task={makeTask(provider)}
          isConnected={false}
        />,
      );

      expect(screen.queryByText('Github detail')).toBeNull();
      expect(screen.queryByText('Gitlab detail')).toBeNull();
      expect(screen.getByRole('button', { name: 'Open #42' })).toBeDefined();
    },
  );
});
