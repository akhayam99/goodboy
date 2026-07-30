// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import type { ResolverStatus } from '../../resolver-linkage';

const SESSION_ID = 'session-1' as SessionId;
const AGENT = {
  id: 'agent-1' as AgentId,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'resolver',
  status: 'completed',
  sourceThreadId: 'PRRT_1',
} satisfies Agent;

const h = vi.hoisted(() => ({
  pending: [] as Array<{ threadId: string; commitSha: string }>,
  resolveGithubThread: vi.fn(async () => true),
  resolveAgentThreads: vi.fn(async () => true),
  queueResolution: vi.fn(async () => undefined),
  dequeueResolution: vi.fn(async () => undefined),
  activateNextResolver: vi.fn(async () => undefined),
  forceCloseResolver: vi.fn(async () => undefined),
  sendTurn: vi.fn(async () => undefined),
  selectAgent: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Record<string, unknown>) => T) =>
    selector({
      resolveGithubThread: h.resolveGithubThread,
      resolveAgentThreads: h.resolveAgentThreads,
      queueResolution: h.queueResolution,
      dequeueResolution: h.dequeueResolution,
      activateNextResolver: h.activateNextResolver,
      forceCloseResolver: h.forceCloseResolver,
      sendTurn: h.sendTurn,
      selectAgent: h.selectAgent,
      agentTurnState: {},
      sessionGithub: { [SESSION_ID]: { pr: { number: 7 } } },
      sessionPendingResolutions: { [SESSION_ID]: h.pending },
      resolverThreadOutcomes: {},
    }),
}));

import { ResolverActions } from './index';

type Params = {
  readonly status: ResolverStatus;
  readonly density?: 'compact' | 'full';
};

const renderActions = ({ status, density = 'full' }: Params) =>
  render(
    <ResolverActions
      agent={AGENT}
      sessionId={SESSION_ID}
      status={status}
      commitSha="abc1234"
      density={density}
      emptyNote="nothing left to do here"
    />,
  );

describe('ResolverActions', () => {
  afterEach(() => {
    cleanup();
    h.pending = [];
    vi.clearAllMocks();
  });

  it('offers push and queue for a committed resolver', () => {
    renderActions({ status: 'committed' });

    expect(screen.getByRole('button', { name: 'Push & resolve' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Queue for batch push' })).toBeDefined();
  });

  it('offers the same actions in the compact chat density', () => {
    renderActions({ status: 'committed', density: 'compact' });

    expect(screen.getByRole('button', { name: 'Push & resolve' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Queue for batch push' })).toBeDefined();
  });

  it('offers remove and push now for a queued resolver', () => {
    h.pending = [{ threadId: 'PRRT_1', commitSha: 'abc1234' }];
    renderActions({ status: 'committed' });

    expect(screen.getByRole('button', { name: 'Remove from batch' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Push now' })).toBeDefined();
  });

  it('routes push now through the agent-wide resolution path', () => {
    h.pending = [{ threadId: 'PRRT_1', commitSha: 'abc1234' }];
    renderActions({ status: 'committed' });

    fireEvent.click(screen.getByRole('button', { name: 'Push now' }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Push now?' })).getByRole('button', {
        name: 'Push now',
      }),
    );

    expect(h.resolveAgentThreads).toHaveBeenCalledWith(SESSION_ID, AGENT.id);
    expect(h.resolveGithubThread).not.toHaveBeenCalled();
    expect(h.dequeueResolution).not.toHaveBeenCalled();
  });

  it('arms a confirm instead of pushing on the first click', () => {
    renderActions({ status: 'committed' });

    fireEvent.click(screen.getByRole('button', { name: 'Push & resolve' }));

    expect(h.resolveGithubThread).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Push & resolve?' })).toBeDefined();
  });

  it('blocks the explanation confirm until a reason is typed', () => {
    renderActions({ status: 'wontfix' });

    fireEvent.click(screen.getByRole('button', { name: 'Post explanation & close' }));
    const confirm = screen.getByRole('button', { name: 'Post & close' });
    expect(confirm.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByRole('textbox', { name: 'resolution explanation' }), {
      target: { value: 'covered by the follow up' },
    });
    expect(screen.getByRole('button', { name: 'Post & close' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('runs the unconfirmed actions straight away', () => {
    renderActions({ status: 'pending' });

    fireEvent.click(screen.getByRole('button', { name: 'Run now' }));

    expect(h.activateNextResolver).toHaveBeenCalledWith(SESSION_ID);
  });

  it('offers proceed and close for analyzed', () => {
    renderActions({ status: 'analyzed' });

    expect(screen.getByRole('button', { name: 'Proceed with fix' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Post explanation & close' })).toBeDefined();
  });

  it('offers continue and a manual resolve for awaiting', () => {
    renderActions({ status: 'awaiting' });

    expect(screen.getByRole('button', { name: 'Continue working' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Mark resolved' })).toBeDefined();
  });

  it('offers force close while running', () => {
    renderActions({ status: 'running' });

    expect(screen.getByRole('button', { name: 'Force close' })).toBeDefined();
  });

  it('falls back to the note when there is nothing to do', () => {
    renderActions({ status: 'resolved' });

    expect(screen.getByText('nothing left to do here')).toBeDefined();
  });
});
