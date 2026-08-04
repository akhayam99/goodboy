// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Agent, AgentId, SessionId, TelemetryRecord } from '@goodboy/types';
import type { ResolverStatus } from '../../resolver-linkage';

const lifecycle = vi.hoisted(() => ({
  setAgentDone: vi.fn(),
  clearAgentDone: vi.fn(),
  deleteAgent: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  agentHasUnread: () => false,
  useAppStore: <T,>(selector: (state: Record<string, unknown>) => T) =>
    selector({
      agentTurnState: {},
      sessionGithub: { 'sess-1': { pr: { number: 7 } } },
      sessionResolvedThreads: {},
      sessionPendingResolutions: {},
      resolverThreadOutcomes: {},
      resolveGithubThread: vi.fn(),
      resolveAgentThreads: vi.fn(),
      queueResolution: vi.fn(),
      dequeueResolution: vi.fn(),
      activateNextResolver: vi.fn(),
      forceCloseResolver: vi.fn(),
      sendTurn: vi.fn(),
      selectAgent: vi.fn(),
      setAgentDone: lifecycle.setAgentDone,
      clearAgentDone: lifecycle.clearAgentDone,
      deleteAgent: lifecycle.deleteAgent,
    }),
}));

import { ResolverCard } from './ResolverCard';
import type { ResolverDiffTarget } from './resolverDiffActionLabel';

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
    readonly contextTokens?: number;
  }>;
  readonly reportedCommitSha?: string | null;
  readonly diffTarget?: ResolverDiffTarget;
  readonly canOpenDiff?: boolean;
  readonly hasOtherActiveResolvers?: boolean;
  readonly onOpenChat?: () => void;
  readonly onInspect?: () => void;
  readonly onOpenDiff?: () => void;
};

const renderCard = ({
  run = agent,
  status = 'done',
  telemetry: cardTelemetry = telemetry,
  contextUsage = [
    {
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      inputTokens: 50_000,
      outputTokens: 0,
      contextTokens: 50_000,
    },
  ],
  reportedCommitSha = null,
  diffTarget = { kind: 'working' },
  canOpenDiff = true,
  hasOtherActiveResolvers = false,
  onOpenChat = () => undefined,
  onInspect = () => undefined,
  onOpenDiff = () => undefined,
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
      diffTarget={diffTarget}
      canOpenDiff={canOpenDiff}
      isQueueStalled={false}
      hasOtherActiveResolvers={hasOtherActiveResolvers}
      isSelected={false}
      isTaskActive
      isInspected={false}
      isMuted={false}
      canJump={false}
      onOpenChat={onOpenChat}
      onInspect={onInspect}
      onJump={() => undefined}
      onOpenDiff={onOpenDiff}
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

  it('mirrors exactly one action, enabled from the reported resolver sha', () => {
    renderCard({ status: 'committed', reportedCommitSha: 'abcdef1234567890' });

    expect(screen.getByRole('button', { name: 'Push & resolve' }).hasAttribute('disabled')).toBe(
      false,
    );
    expect(screen.queryByRole('button', { name: 'Add to push batch' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Force close' })).toBeNull();
  });

  it('mirrors the batch action instead while other resolvers are still active', () => {
    renderCard({
      status: 'committed',
      reportedCommitSha: 'abcdef1234567890',
      hasOtherActiveResolvers: true,
    });

    expect(screen.getByRole('button', { name: 'Add to push batch' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Push now' })).toBeNull();
  });

  it('opens the panel rather than executing an action that needs typed input', () => {
    const onInspect = vi.fn();
    renderCard({ status: 'wontfix', onInspect });

    fireEvent.click(screen.getByRole('button', { name: 'Post explanation & close' }));

    expect(onInspect).toHaveBeenCalledOnce();
  });

  it('keeps duration and last update on the one fact line', () => {
    const meta = within(renderCard().getByTestId('agent-metrics-inline'));
    expect(meta.getByTitle(/^Started .+2026/)).toBeTruthy();
    expect(meta.getByText(/^updated /)).toBeTruthy();
  });

  it('leaves the token split and the context gauge to the inspector', () => {
    const { container } = renderCard();
    expect(screen.queryByTestId('agent-metrics-block')).toBeNull();
    expect(screen.queryByTitle('in: 400 tokens (cumulative)')).toBeNull();
    expect(container.querySelector('[title*="last turn context:"]')).toBeNull();
  });

  it('keeps the resolver name and its origin readable alongside the metrics', () => {
    renderCard();
    const name = screen.getByText('resolve comment 12');
    expect(name.previousElementSibling?.getAttribute('title')).toBe('needs you');
    expect(name.className).toContain('text-sm');
    expect(screen.queryByText(/^\d+\/\d+$/)).toBeNull();
    expect(screen.getByText('Review comment')).toBeTruthy();
  });

  it('names the commit the diff shortcut will open, and reaches it without the inspector', () => {
    const onOpenDiff = vi.fn();
    const onInspect = vi.fn();
    renderCard({
      diffTarget: { kind: 'commit', sha: 'abcdef1234567890' },
      onOpenDiff,
      onInspect,
    });

    const shortcut = screen.getByRole('button', { name: 'Open the diff of commit abcdef1' });
    const navigationSlot = screen.getByRole('group', { name: 'Agent navigation actions' });
    expect(navigationSlot.contains(shortcut)).toBe(true);

    fireEvent.click(shortcut);

    expect(onOpenDiff).toHaveBeenCalledOnce();
    expect(onInspect).not.toHaveBeenCalled();
  });

  it('says it will open the uncommitted changes once confirmed the resolver has no commit', () => {
    renderCard({ diffTarget: { kind: 'working' } });

    expect(
      screen.getByRole('button', { name: 'Open the diff of the uncommitted changes' }),
    ).toBeTruthy();
  });

  it('never claims working tree or a commit while the diff metadata is still loading', () => {
    renderCard({ diffTarget: { kind: 'unknown' } });

    expect(screen.getByRole('button', { name: 'Open the diff' })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Open the diff of the uncommitted changes' }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: /Open the diff of commit/ })).toBeNull();
  });

  it('drops the diff shortcut when the session has no worktree to diff', () => {
    renderCard({ diffTarget: { kind: 'commit', sha: 'abcdef1234567890' }, canOpenDiff: false });

    expect(screen.queryByRole('button', { name: /Open the diff/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Toggle resolver details' })).toBeTruthy();
  });

  it('opens the chat from the card body and keeps details behind an explicit action', () => {
    const onOpenChat = vi.fn();
    const onInspect = vi.fn();
    renderCard({ onOpenChat, onInspect });

    fireEvent.click(screen.getByRole('button', { name: 'resolve comment 12' }));
    expect(onOpenChat).toHaveBeenCalledOnce();
    expect(onInspect).not.toHaveBeenCalled();

    expect(screen.queryByRole('button', { name: 'Open resolver chat' })).toBeNull();

    const details = screen.getByRole('button', { name: 'Toggle resolver details' });
    const navigationSlot = screen.getByRole('group', { name: 'Agent navigation actions' });
    expect(navigationSlot.contains(details)).toBe(true);
    expect(details.className).not.toContain('opacity-0');

    fireEvent.click(details);
    expect(onInspect).toHaveBeenCalledOnce();
    expect(onOpenChat).toHaveBeenCalledOnce();
  });

  it('marks the resolver done from the card', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Mark resolver done' }));
    expect(lifecycle.setAgentDone).toHaveBeenCalledWith(SID, 'resolver-1');
  });

  it('offers reopen instead of mark done once the resolver is done', () => {
    renderCard({ run: { ...agent, doneAt: '2026-05-28T00:02:00Z' } as Agent });
    expect(screen.queryByRole('button', { name: 'Mark resolver done' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen resolver' }));
    expect(lifecycle.clearAgentDone).toHaveBeenCalledWith(SID, 'resolver-1');
  });

  it('deletes the resolver only after the confirm step', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Delete resolver' }));
    expect(lifecycle.deleteAgent).not.toHaveBeenCalled();

    const panel = screen.getByRole('group', { name: 'Delete this resolver?' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Delete' }));
    expect(lifecycle.deleteAgent).toHaveBeenCalledWith(SID, 'resolver-1');
  });

  it('keeps the lifecycle actions in their own slot, away from navigation', () => {
    renderCard();
    const lifecycleSlot = screen.getByRole('group', { name: 'Agent lifecycle actions' });
    expect(lifecycleSlot.contains(screen.getByRole('button', { name: 'Delete resolver' }))).toBe(
      true,
    );
    const navigationSlot = screen.getByRole('group', { name: 'Agent navigation actions' });
    expect(navigationSlot.contains(screen.getByRole('button', { name: 'Delete resolver' }))).toBe(
      false,
    );
  });
});
