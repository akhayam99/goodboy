import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { AgentLastUpdate } from './index';

const agent = (stamps: Partial<Agent>): Agent =>
  ({
    id: 'a1' as AgentId,
    sessionId: 's1' as SessionId,
    ordinal: 0,
    name: 'agent 1',
    status: 'pending',
    ...stamps,
  }) as Agent;

describe('AgentLastUpdate', () => {
  it('says the agent has not started when it carries no timestamp', () => {
    render(<AgentLastUpdate agent={agent({})} />);
    expect(screen.getByText('not started')).toBeDefined();
  });

  it('shows how long ago the agent last moved', () => {
    const tenMinutesAgo = new Date(Date.now() - (10 * 60_000 + 5_000)).toISOString() as IsoDateTime;
    render(<AgentLastUpdate agent={agent({ lastFinishedAt: tenMinutesAgo })} />);
    expect(screen.getByText('updated 10m ago')).toBeDefined();
  });
});
