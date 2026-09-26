// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach } from 'vitest';
import type { ProjectId, Session, SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  store: {
    sessionProjectMounts: {} as Record<string, ReadonlyArray<unknown>>,
    sessions: [] as ReadonlyArray<Session>,
    navigate: vi.fn(),
  },
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof h.store) => T) => selector(h.store),
  useSessionStageInfo: () => ({ stage: 'active', reason: '', attention: null, prState: null }),
}));
vi.mock('../../../session-stage', () => ({
  describeSessionStage: () => ({ label: 'Active', reason: null, tone: 'info', icon: null }),
}));

import { AlsoInChip } from './AlsoInChip';

const SESSION_ID = 'session-1' as SessionId;
const OTHER_SESSION_ID = 'session-2' as SessionId;
const PROJECT_ID = 'project-1' as ProjectId;

const otherSession = {
  id: OTHER_SESSION_ID,
  goal: 'Statement backfill',
} as Session;

afterEach(() => {
  cleanup();
  h.store.sessionProjectMounts = {};
  h.store.sessions = [];
  h.store.navigate = vi.fn();
});

describe('AlsoInChip', () => {
  it('renders nothing when no other session shares this branch', () => {
    h.store.sessionProjectMounts = {
      [SESSION_ID]: [{ projectId: PROJECT_ID, branch: 'ak/shared', sessionId: SESSION_ID }],
    };

    const { container } = render(
      <AlsoInChip sessionId={SESSION_ID} projectId={PROJECT_ID} branch="ak/shared" />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('names the other session and navigates to it on click', () => {
    h.store.sessionProjectMounts = {
      [SESSION_ID]: [{ projectId: PROJECT_ID, branch: 'ak/shared', sessionId: SESSION_ID }],
      [OTHER_SESSION_ID]: [
        { projectId: PROJECT_ID, branch: 'ak/shared', sessionId: OTHER_SESSION_ID },
      ],
    };
    h.store.sessions = [otherSession];

    render(<AlsoInChip sessionId={SESSION_ID} projectId={PROJECT_ID} branch="ak/shared" />);

    expect(screen.getByText('Statement backfill')).toBeDefined();
    fireEvent.click(screen.getByRole('button'));
    expect(h.store.navigate).toHaveBeenCalledWith({
      to: {
        at: 'session',
        sessionId: OTHER_SESSION_ID,
        view: { lens: null, agentId: null, studio: null, target: null },
      },
    });
  });
});
