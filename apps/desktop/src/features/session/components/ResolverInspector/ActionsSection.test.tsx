import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
  queueResolution: vi.fn(async () => undefined),
  dequeueResolution: vi.fn(async () => undefined),
  activateNextResolver: vi.fn(async () => undefined),
  sendTurn: vi.fn(async () => undefined),
  selectAgent: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (state: {
      resolveGithubThread: typeof h.resolveGithubThread;
      queueResolution: typeof h.queueResolution;
      dequeueResolution: typeof h.dequeueResolution;
      activateNextResolver: typeof h.activateNextResolver;
      sendTurn: typeof h.sendTurn;
      selectAgent: typeof h.selectAgent;
      sessionGithub: Record<string, { pr: { number: number } }>;
      sessionPendingResolutions: Record<string, Array<{ threadId: string; commitSha: string }>>;
    }) => T,
  ) =>
    selector({
      resolveGithubThread: h.resolveGithubThread,
      queueResolution: h.queueResolution,
      dequeueResolution: h.dequeueResolution,
      activateNextResolver: h.activateNextResolver,
      sendTurn: h.sendTurn,
      selectAgent: h.selectAgent,
      sessionGithub: { [SESSION_ID]: { pr: { number: 7 } } },
      sessionPendingResolutions: { [SESSION_ID]: h.pending },
    }),
}));

import { ActionsSection } from './ActionsSection';

type RenderParams = {
  readonly status: ResolverStatus;
};

const renderSection = ({ status }: RenderParams) =>
  render(
    <ActionsSection agent={AGENT} sessionId={SESSION_ID} status={status} commitSha="abc1234" />,
  );

describe('ActionsSection', () => {
  afterEach(() => {
    cleanup();
    h.pending = [];
  });

  it('offers push and queue for a committed resolver', () => {
    renderSection({ status: 'committed' });

    expect(screen.getByRole('button', { name: 'Push & resolve' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Queue for batch push' })).toBeDefined();
  });

  it('offers remove and push for a queued resolver', () => {
    h.pending = [{ threadId: 'PRRT_1', commitSha: 'abc1234' }];
    renderSection({ status: 'committed' });

    expect(screen.getByRole('button', { name: 'Remove from batch' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Push now' })).toBeDefined();
  });

  it('offers an editable explanation for wontfix', () => {
    renderSection({ status: 'wontfix' });

    expect(screen.getByRole('textbox', { name: 'resolution explanation' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Post explanation & close' })).toBeDefined();
  });

  it('offers proceed and close for analyzed', () => {
    renderSection({ status: 'analyzed' });

    expect(screen.getByRole('button', { name: 'Proceed with fix' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Post explanation & close' })).toBeDefined();
  });

  it('offers continue for awaiting', () => {
    renderSection({ status: 'awaiting' });

    expect(screen.getByRole('button', { name: 'Continue working' })).toBeDefined();
  });

  it('offers run now for pending', () => {
    renderSection({ status: 'pending' });

    expect(screen.getByRole('button', { name: 'Run now' })).toBeDefined();
  });
});
