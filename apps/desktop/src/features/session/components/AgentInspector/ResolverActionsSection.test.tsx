// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import type { ResolverStatus } from '../../resolver-linkage';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;

const state = {
  agentTurnState: {},
  sessionGithub: {},
  sessionPendingResolutions: {},
  resolverThreadOutcomes: {},
  resolveGithubThread: vi.fn(),
  resolveAgentThreads: vi.fn(),
  queueResolution: vi.fn(),
  dequeueResolution: vi.fn(),
  activateNextResolver: vi.fn(),
  forceCloseResolver: vi.fn(),
  sendTurn: vi.fn(),
  selectAgent: vi.fn(),
};

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (value: typeof state) => T) => selector(state),
}));

import { ResolverActionsSection } from './ResolverActionsSection';

const agent = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'resolver',
  status: 'completed',
} as Agent;

type Params = {
  readonly status: ResolverStatus;
};

const renderSection = ({ status }: Params) =>
  render(
    <ResolverActionsSection
      agent={agent}
      sessionId={SESSION_ID}
      status={status}
      commitSha={null}
    />,
  );

afterEach(cleanup);

describe('ResolverActionsSection', () => {
  it.each(['resolved', 'done', 'stopped'] satisfies ReadonlyArray<ResolverStatus>)(
    'shows the completed idle note for %s',
    (status) => {
      renderSection({ status });

      expect(screen.getByText('nothing left to do here')).toBeDefined();
    },
  );

  it('renders available actions instead of an idle note', () => {
    renderSection({ status: 'pending' });

    expect(screen.getByRole('button', { name: 'Run now' })).toBeDefined();
    expect(screen.queryByText('no additional actions right now')).toBeNull();
  });
});
