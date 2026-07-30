// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId, SessionId, TelemetryRecord } from '@goodboy/types';
import type { ResolverStatus } from '../../resolver-linkage';

vi.mock('../../../../store', () => ({
  agentHasUnread: () => false,
  useAppStore: <T,>(selector: (state: Record<string, unknown>) => T) =>
    selector({
      agentTurnState: {},
      sessionGithub: { 'sess-1': { pr: { number: 7 } } },
      sessionPendingResolutions: {},
      resolverThreadOutcomes: {},
    }),
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
  sourceThreadId: 'PRRT_1',
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
  readonly run?: Agent;
  readonly status?: ResolverStatus;
  readonly telemetry?: TelemetryRecord | null;
  readonly contextUsage?: ReadonlyArray<{
    readonly provider: 'anthropic';
    readonly model: string;
    readonly inputTokens: number;
    readonly outputTokens: number;
  }>;
  readonly reportedCommitSha?: string | null;
  readonly onOpenChat?: () => void;
  readonly onInspect?: () => void;
};

const renderCard = ({
  run = agent,
  status = 'done',
  telemetry: cardTelemetry = telemetry,
  contextUsage = [
    { provider: 'anthropic', model: 'claude-haiku-4-5', inputTokens: 50_000, outputTokens: 0 },
  ],
  reportedCommitSha = null,
  onOpenChat = () => undefined,
  onInspect = () => undefined,
}: Params = {}) =>
  render(
    <ResolverCard
      agent={run}
      status={status}
      threadComment={null}
      diffComment={null}
      telemetry={cardTelemetry}
      aggregate={{ inputTokens: 400, outputTokens: 40, estimatedCostUsd: 0.75, turns: 2 }}
      contextUsage={contextUsage}
      turns={2}
      turnsLoading={false}
      reportedCommitSha={reportedCommitSha}
      isSelected={false}
      isTaskActive
      isInspected={false}
      isMuted={false}
      canJump={false}
      onOpenChat={onOpenChat}
      onInspect={onInspect}
      onJump={() => undefined}
    />,
  );

afterEach(cleanup);

describe('ResolverCard', () => {
  it('shows model, cost, context share and turns without being selected', () => {
    renderCard();
    expect(screen.getByTestId('agent-metrics-inline')).toBeTruthy();
    expect(screen.getByText('Haiku 4.5')).toBeTruthy();
    expect(screen.getByText('2t')).toBeTruthy();
    expect(screen.getByText(/ctx \d+%/)).toBeTruthy();
  });

  it('shows the planned model before telemetry arrives', () => {
    renderCard({
      run: { ...agent, modelOverride: 'claude-haiku-4-5' },
      telemetry: null,
      contextUsage: [],
    });

    expect(screen.getByText('Haiku 4.5')).toBeTruthy();
    expect(screen.queryByText('no model yet')).toBeNull();
  });

  it('enables commit actions from the reported resolver sha', () => {
    renderCard({ status: 'committed', reportedCommitSha: 'abcdef1234567890' });

    expect(screen.getByRole('button', { name: 'Push & resolve' }).hasAttribute('disabled')).toBe(
      false,
    );
    expect(
      screen.getByRole('button', { name: 'Queue for batch push' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('shows the token split, duration and context gauge without being selected', () => {
    const { container } = renderCard();
    expect(screen.getByTestId('agent-metrics-block')).toBeTruthy();
    expect(screen.getByTitle('in: 400 tokens (cumulative)')).toBeTruthy();
    expect(screen.getByTitle('out: 40 tokens (cumulative)')).toBeTruthy();
    expect(screen.getByTitle(/^started .+2026/)).toBeTruthy();
    expect(container.querySelectorAll('[title*="context:"]').length).toBeGreaterThan(0);
  });

  it('keeps the resolver name and its origin readable alongside the metrics', () => {
    renderCard();
    expect(
      screen.getByText('resolve comment 12').previousElementSibling?.getAttribute('title'),
    ).toBe('done');
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
