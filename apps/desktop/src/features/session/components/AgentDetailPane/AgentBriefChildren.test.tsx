// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import type { SpawnedChild } from '../../../../shared/utils/spawnedChildren';

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (value: { selectAgent: () => void }) => T) =>
    selector({ selectAgent: () => undefined }),
}));

vi.mock('../../hooks/useAgentMetrics', () => ({
  useAgentMetrics: () => ({
    aggregatesByAgentId: new Map([['child-1', { estimatedCostUsd: 0.42 }]]),
  }),
}));

import { AgentBriefChildren } from './AgentBriefChildren';

const sessionId = 'session-1' as SessionId;
const session = { id: sessionId } as unknown as Session;

const child = (over: Partial<SpawnedChild> = {}): SpawnedChild => ({
  agent: {
    id: 'child-1' as AgentId,
    sessionId,
    ordinal: 0,
    name: 'Split the store',
    status: 'completed',
    kind: 'implementer',
  } as Agent,
  index: 0,
  total: 1,
  status: 'completed',
  assignment: null,
  ...over,
});

afterEach(cleanup);

describe('AgentBriefChildren type scale', () => {
  it('sits a child row label on the nested row grade the feed gives the same agent', () => {
    render(<AgentBriefChildren session={session} kind="implementer" children={[child()]} />);

    const label = screen.getByText('Split the store');

    expect(label.className).toContain('text-xs');
    expect(label.className).toContain('leading-4');
    expect(label.className).not.toContain('text-sm');
  });

  it('declares a line height on the row label, since text-xs has no pinned line box', () => {
    render(<AgentBriefChildren session={session} kind="implementer" children={[child()]} />);

    expect(screen.getByText('Split the store').className).toMatch(/\bleading-\d/);
  });

  it('drops the ordinal and the cost to the metadata grade a feed row uses', () => {
    render(<AgentBriefChildren session={session} kind="implementer" children={[child()]} />);

    expect(screen.getByText('1').className).toContain('text-3xs');
    expect(screen.getByText(/^\$0\.42/).className).toContain('text-3xs');
  });

  it('keeps the status word one grade above metadata, as a secondary label', () => {
    render(<AgentBriefChildren session={session} kind="implementer" children={[child()]} />);

    expect(screen.getByText('completed').className).toContain('text-2xs');
  });

  it('labels the section on the eyebrow grade rather than a page heading', () => {
    render(<AgentBriefChildren session={session} kind="implementer" children={[child()]} />);

    expect(screen.getByText('Clusters').className).toContain('text-2xs');
  });
});
