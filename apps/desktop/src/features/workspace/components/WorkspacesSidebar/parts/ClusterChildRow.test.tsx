// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';

vi.mock('@goodboy/ui', () => ({
  cn: (...a: unknown[]) => a.filter(Boolean).join(' '),
}));

vi.mock('../../../../../store', () => ({
  agentHasUnread: (agent: Agent, isCurrentlyViewed: boolean): boolean => {
    if (isCurrentlyViewed || agent.status === 'skipped' || !agent.lastFinishedAt) {
      return false;
    }
    return !agent.lastViewedAt || agent.lastFinishedAt > agent.lastViewedAt;
  },
}));

import { ClusterChildRow } from './ClusterChildRow';

const SESSION_ID = 'session-1' as SessionId;
const NOW = '2026-06-16T00:00:00.000Z' as IsoDateTime;

function buildAgent(overrides: Partial<Agent> & Pick<Agent, 'id'>): Agent {
  return {
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'child agent',
    status: 'completed',
    ...overrides,
  };
}

function renderRow(child: Agent, opts: { isSelected?: boolean; isTaskActive?: boolean } = {}) {
  const onSelect = vi.fn();
  render(
    <ClusterChildRow
      child={child}
      index={0}
      total={3}
      costUsd={0}
      isSelected={opts.isSelected ?? false}
      isTaskActive={opts.isTaskActive ?? true}
      onSelect={onSelect}
    />,
  );
  return { onSelect, button: screen.getByRole('button') };
}

describe('ClusterChildRow unread border', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows the warning border for a finished, never-viewed child that is not selected', () => {
    const { button } = renderRow(buildAgent({ id: 'c1' as AgentId, lastFinishedAt: NOW }), {
      isSelected: false,
    });
    expect(button.className).toContain('border-warning/70');
    expect(button.className).toContain('bg-warning/5');
  });

  it('hides the warning border when the child is selected (currently viewed)', () => {
    const { button } = renderRow(buildAgent({ id: 'c1' as AgentId, lastFinishedAt: NOW }), {
      isSelected: true,
      isTaskActive: true,
    });
    expect(button.className).not.toContain('border-warning/70');
  });

  it('hides the warning border when finished work was already viewed', () => {
    const { button } = renderRow(
      buildAgent({ id: 'c1' as AgentId, lastFinishedAt: NOW, lastViewedAt: NOW }),
    );
    expect(button.className).not.toContain('border-warning/70');
  });

  it('hides the warning border for a skipped child', () => {
    const { button } = renderRow(
      buildAgent({ id: 'c1' as AgentId, status: 'skipped', lastFinishedAt: NOW }),
    );
    expect(button.className).not.toContain('border-warning/70');
  });

  it('hides the warning border for a child that has not finished', () => {
    const { button } = renderRow(buildAgent({ id: 'c1' as AgentId, status: 'running' }));
    expect(button.className).not.toContain('border-warning/70');
  });

  it('selected wins over unread even when the task is inactive', () => {
    const { button } = renderRow(buildAgent({ id: 'c1' as AgentId, lastFinishedAt: NOW }), {
      isSelected: true,
      isTaskActive: false,
    });
    expect(button.className).not.toContain('border-warning/70');
  });

  it('invokes onSelect when clicked', () => {
    const { onSelect, button } = renderRow(buildAgent({ id: 'c1' as AgentId }));
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
