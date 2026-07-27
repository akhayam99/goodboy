// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId, SessionId, TelemetryRecord } from '@goodboy/types';

vi.mock('../../../../store', () => ({
  agentHasUnread: () => false,
}));

vi.mock('../ForceResolveAction', () => ({
  ForceResolveAction: () => null,
}));

vi.mock('../ForceCloseResolverAction', () => ({
  ForceCloseResolverAction: () => null,
}));

import { ResolverCard } from './ResolverCard';

const SID = 'sess-1' as SessionId;

const agent = {
  id: 'resolver-1' as AgentId,
  sessionId: SID,
  ordinal: 0,
  name: 'resolve comment 12',
  status: 'completed',
  sourceKind: 'review_comment',
  startedAt: '2026-05-28T00:00:00Z',
  completedAt: '2026-05-28T00:01:00Z',
} as Agent;

const telemetry = {
  runId: 'run-1',
  kind: 'turn',
  provider: 'anthropic',
  model: 'claude-haiku-4-5',
  inputTokens: 10,
  outputTokens: 2,
  estimatedCostUsd: 0.05,
  recordedAt: '2026-01-01T00:00:00.000Z',
} as TelemetryRecord;

type Params = {
  readonly onOpenChat?: () => void;
  readonly onInspect?: () => void;
};

const renderCard = ({ onOpenChat = () => undefined, onInspect = () => undefined }: Params = {}) =>
  render(
    <ResolverCard
      agent={agent}
      status="done"
      threadComment={null}
      diffComment={null}
      telemetry={telemetry}
      aggregate={{ inputTokens: 400, outputTokens: 40, estimatedCostUsd: 0.75, turns: 2 }}
      contextUsage={[
        { provider: 'anthropic', model: 'claude-haiku-4-5', inputTokens: 50_000, outputTokens: 0 },
      ]}
      turns={2}
      turnsLoading={false}
      isSelected={false}
      isTaskActive
      isInspected={false}
      isMuted={false}
      canJump={false}
      onOpenChat={onOpenChat}
      onInspect={onInspect}
      onJump={() => undefined}
      onResolveThread={() => undefined}
      onResolveAgent={() => undefined}
    />,
  );

afterEach(cleanup);

describe('ResolverCard', () => {
  it('shows model, cost, context share and turns without being selected', () => {
    renderCard();
    expect(screen.getByTestId('agent-metrics-inline')).toBeTruthy();
    expect(screen.getByText('haiku 4.5')).toBeTruthy();
    expect(screen.getByText('2t')).toBeTruthy();
    expect(screen.getByText(/ctx \d+%/)).toBeTruthy();
  });

  it('shows the token split, duration and context gauge without being selected', () => {
    const { container } = renderCard();
    expect(screen.getByTestId('agent-metrics-block')).toBeTruthy();
    expect(screen.getByTitle('in: 400 tokens (cumulative)')).toBeTruthy();
    expect(screen.getByTitle('out: 40 tokens (cumulative)')).toBeTruthy();
    expect(screen.getByTitle(/^started 2026-05-28/)).toBeTruthy();
    expect(container.querySelectorAll('[title*="context:"]').length).toBeGreaterThan(0);
  });

  it('keeps the resolver name and its origin readable alongside the metrics', () => {
    renderCard();
    expect(screen.getByText('resolve comment 12')).toBeTruthy();
    expect(screen.queryByText(/^\d+\/\d+$/)).toBeNull();
    expect(screen.getByText('Review comment')).toBeTruthy();
  });

  it('opens the chat from the card body and keeps details behind an explicit action', () => {
    const onOpenChat = vi.fn();
    const onInspect = vi.fn();
    renderCard({ onOpenChat, onInspect });

    fireEvent.click(screen.getByRole('button', { name: 'resolve comment 12' }));
    expect(onOpenChat).toHaveBeenCalledOnce();
    expect(onInspect).not.toHaveBeenCalled();

    expect(screen.queryByRole('button', { name: 'Open resolver chat' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Toggle resolver details' }));
    expect(onInspect).toHaveBeenCalledOnce();
    expect(onOpenChat).toHaveBeenCalledOnce();
  });
});
