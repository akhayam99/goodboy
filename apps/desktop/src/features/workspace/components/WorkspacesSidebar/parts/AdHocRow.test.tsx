// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Agent, AgentId, SessionId } from '@goodboy/types';

vi.mock('../../../../../store', () => {
  const useAppStore = Object.assign(() => undefined, {
    getState: () => ({ markAgentSeen: vi.fn(async () => undefined) }),
  });
  return {
    EMPTY_ARRAY: [] satisfies never[],
    agentHasUnread: () => false,
    useAppStore,
  };
});

import { AdHocRow } from './AdHocRow';

const SESSION_ID = 'session-1' as SessionId;
const PARENT_ID = 'parent-1' as AgentId;

type RenderRowParams = {
  readonly children?: ReadonlyArray<Agent>;
};

type BuildAgentParams = {
  readonly id: AgentId;
  readonly status: Agent['status'];
};

const buildAgent = ({ id, status }: BuildAgentParams): Agent => ({
  id,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: id,
  status,
  kind: 'implementer',
});

const renderRow = ({ children = [] }: RenderRowParams = {}) => {
  const childrenByParentId = new Map<string, Agent[]>();
  if (children.length > 0) {
    childrenByParentId.set(PARENT_ID, [...children]);
  }
  return render(
    <ul>
      <AdHocRow
        run={buildAgent({ id: PARENT_ID, status: 'running' })}
        firstUserTextByAgentId={new Map()}
        agentKindOverride={{}}
        childrenByParentId={childrenByParentId}
        latestTelemetryByAgentId={new Map()}
        aggregatesByAgentId={new Map()}
        providerUsageByAgentId={new Map()}
        turnsByAgentId={new Map()}
        selectedAgentId={null}
        isTranscriptLoading={false}
        isTaskActive
        editingId={null}
        setEditingId={vi.fn()}
        clusterExpand={new Map()}
        toggleClusterExpand={vi.fn()}
        onPickAgent={vi.fn()}
        onRenameCommit={vi.fn(async () => undefined)}
        onDeleteAgent={vi.fn(async () => undefined)}
        onMarkDone={vi.fn()}
      />
    </ul>,
  );
};

afterEach(cleanup);

describe('AdHocRow delegation state', () => {
  it('shows active delegated children and hides the missing model fallback', () => {
    renderRow({
      children: [
        buildAgent({ id: 'child-1' as AgentId, status: 'pending' }),
        buildAgent({ id: 'child-2' as AgentId, status: 'running' }),
        buildAgent({ id: 'child-3' as AgentId, status: 'completed' }),
      ],
    });

    expect(screen.getByText('delegated · 2/3 running')).toBeDefined();
    expect(screen.queryByText('no model yet')).toBeNull();
  });

  it('shows delegated done when every child is terminal', () => {
    renderRow({
      children: [
        buildAgent({ id: 'child-1' as AgentId, status: 'completed' }),
        buildAgent({ id: 'child-2' as AgentId, status: 'failed' }),
      ],
    });

    expect(screen.getByText('delegated · done')).toBeDefined();
  });

  it('keeps not started and the missing model fallback for a childless parent', () => {
    renderRow();

    expect(screen.getByText('not started')).toBeDefined();
    expect(screen.getByText('no model yet')).toBeDefined();
  });
});
