// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId, IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';

vi.mock('../../../../store', () => {
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
  readonly run?: Agent;
  readonly askingIds?: ReadonlyArray<AgentId>;
};

const onClose = vi.fn();
const onReopen = vi.fn();

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

const renderRow = ({
  children = [],
  run = buildAgent({ id: PARENT_ID, status: 'running' }),
  askingIds = [],
}: RenderRowParams = {}) => {
  const childrenByParentId = new Map<string, Agent[]>();
  if (children.length > 0) {
    childrenByParentId.set(PARENT_ID, [...children]);
  }
  return render(
    <ul>
      <AdHocRow
        run={run}
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
        signals={{ openQuestionAgentIds: new Set(askingIds), liveTurnAgentIds: new Set() }}
        onClose={onClose}
        onReopen={onReopen}
      />
    </ul>,
  );
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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
    expect(screen.queryByText('Model not chosen yet')).toBeNull();
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
    expect(screen.getByText('Model not chosen yet')).toBeDefined();
  });
});

describe('AdHocRow lifecycle actions', () => {
  it('offers close to a failed agent outside a workflow', () => {
    renderRow({ run: buildAgent({ id: PARENT_ID, status: 'failed' }) });

    fireEvent.click(screen.getByRole('button', { name: 'Close agent' }));

    expect(onClose).toHaveBeenCalledWith(PARENT_ID);
  });

  it('offers close to an agent waiting on its own question', () => {
    renderRow({ run: buildAgent({ id: PARENT_ID, status: 'completed' }), askingIds: [PARENT_ID] });

    expect(screen.getByRole('button', { name: 'Close agent' })).toBeDefined();
  });

  it('offers nothing to an agent that finished on its own', () => {
    renderRow({ run: buildAgent({ id: PARENT_ID, status: 'completed' }) });

    expect(screen.queryByRole('button', { name: 'Close agent' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reopen agent' })).toBeNull();
  });

  it('keeps close off a workflow step, which skips instead', () => {
    renderRow({
      run: {
        ...buildAgent({ id: PARENT_ID, status: 'failed' }),
        workflowRunId: 'run-1' as WorkflowRunId,
      },
    });

    expect(screen.queryByRole('button', { name: 'Close agent' })).toBeNull();
  });

  it('offers reopen once you closed the agent', () => {
    renderRow({
      run: {
        ...buildAgent({ id: PARENT_ID, status: 'failed' }),
        doneAt: '2026-09-24T10:00:00.000Z' as IsoDateTime,
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reopen agent' }));

    expect(onReopen).toHaveBeenCalledWith(PARENT_ID);
  });
});
