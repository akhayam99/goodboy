import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId, SessionId } from '@goodboy/types';

vi.mock('./ResolverRows', () => ({
  ResolverRows: ({ entries }: { entries: ReadonlyArray<{ agent: Agent; status: string }> }) => (
    <>
      {entries.map(({ agent, status }) => (
        <span key={agent.id}>
          {agent.name}:{status}
        </span>
      ))}
    </>
  ),
}));

vi.mock('../../../../../shared/lib/editor', () => ({ openUrl: vi.fn() }));

import { ResolveCluster } from './ResolveCluster';

const SESSION_ID = 'session-1' as SessionId;
const active = {
  id: 'active' as AgentId,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'Active resolver',
  status: 'running',
} satisfies Agent;
const completed = {
  id: 'completed' as AgentId,
  sessionId: SESSION_ID,
  ordinal: 1,
  name: 'Completed resolver',
  status: 'completed',
  sourceThreadId: 'PRRT_1',
} satisfies Agent;

describe('ResolveCluster', () => {
  afterEach(cleanup);

  it('keeps active resolvers visible and completed resolvers collapsed', () => {
    render(
      <ResolveCluster
        agents={[active, completed]}
        sessionId={SESSION_ID}
        isTaskActive
        prNumber={null}
        resolvedThreadIds={new Set(['PRRT_1'])}
        pendingThreadIds={new Set()}
        resolverState={{}}
        commentByThreadId={new Map()}
        diffCommentByAgentId={new Map()}
        metrics={{
          latestTelemetryByAgentId: new Map(),
          aggregatesByAgentId: new Map(),
          providerUsageByAgentId: new Map(),
          turnsByAgentId: new Map(),
        }}
        isTranscriptLoading={false}
        selectedAgentId={null}
        expanded
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onForceNext={vi.fn()}
        onResolveThread={vi.fn()}
        onResolveAgent={vi.fn()}
      />,
    );

    expect(screen.getByText('Active resolver:running')).toBeDefined();
    expect(screen.queryByText('Completed resolver:resolved')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Completed (1)' }));

    expect(screen.getByText('Completed resolver:resolved')).toBeDefined();
  });
});
