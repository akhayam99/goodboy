import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCheck,
  CircleStop,
  Clock,
  MessageSquareReply,
  Play,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react';
import { InlineConfirm, Textarea, cn } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ResolverThreadOutcome } from '../../../../store/types';
import { PROCEED_RESOLVER_PROMPT } from '../../../../shared/utils/proceedResolverPrompt';
import { agentThreadIds } from '../../agentThreadIds';
import type { ResolverStatus } from '../../resolver-linkage';
import { resolverCommitSha } from '../../resolverCommitSha';
import {
  resolverActions,
  type ResolverAction,
  type ResolverActionKind,
  type ResolverActionRole,
} from '../../resolverActions';
import { INSPECTOR_ACTION_CLASS } from '../InspectorSection';

type Density = 'compact' | 'full';

type Props = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
  readonly status: ResolverStatus;
  readonly commitSha: string | null;
  readonly density: Density;
  readonly emptyNote?: string;
};

const EMPTY_PENDING: ReadonlyArray<never> = [];
const EMPTY_OUTCOMES: Readonly<Record<string, ResolverThreadOutcome>> = {};

const ICON: Record<ResolverActionKind, LucideIcon> = {
  push: Upload,
  queue: Clock,
  dequeue: X,
  explain: MessageSquareReply,
  proceed: Play,
  continue: ArrowRight,
  run: Play,
  forceClose: CircleStop,
  forceResolve: CheckCheck,
};

const COMPACT_ROLE: Record<ResolverActionRole, string> = {
  primary: 'border-info/40 text-info hover:bg-info/10',
  alert: 'border-warning/40 text-warning hover:bg-warning/10',
  danger: 'border-danger/40 text-danger hover:bg-danger/10',
  neutral: 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
};

const FULL_ROLE: Record<ResolverActionRole, string> = {
  primary: 'text-primary hover:text-primary',
  alert: 'text-warning hover:text-warning',
  danger: 'text-danger hover:text-danger',
  neutral: '',
};

const COMPACT_CLASS =
  'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-60';

export const ResolverActions = ({
  agent,
  sessionId,
  status,
  commitSha,
  density,
  emptyNote,
}: Props) => {
  const resolveGithubThread = useAppStore((state) => state.resolveGithubThread);
  const resolveAgentThreads = useAppStore((state) => state.resolveAgentThreads);
  const queueResolution = useAppStore((state) => state.queueResolution);
  const dequeueResolution = useAppStore((state) => state.dequeueResolution);
  const activateNextResolver = useAppStore((state) => state.activateNextResolver);
  const forceCloseResolver = useAppStore((state) => state.forceCloseResolver);
  const sendTurn = useAppStore((state) => state.sendTurn);
  const selectAgent = useAppStore((state) => state.selectAgent);
  const turnState = useAppStore((state) => state.agentTurnState[agent.id]);
  const prNumber = useAppStore((state) => state.sessionGithub[sessionId]?.pr?.number ?? null);
  const pending =
    useAppStore((state) => state.sessionPendingResolutions[sessionId]) ?? EMPTY_PENDING;
  const outcomes = useAppStore((state) => state.resolverThreadOutcomes[agent.id]) ?? EMPTY_OUTCOMES;
  const [reason, setReason] = useState('');
  const [armed, setArmed] = useState<ResolverActionKind | null>(null);

  useEffect(() => {
    setReason('');
    setArmed(null);
  }, [agent.id]);

  const threadIds = agentThreadIds(agent);
  const threadId = threadIds[0] ?? null;
  const pendingResolutions = pending.filter((resolution) =>
    threadIds.includes(resolution.threadId),
  );
  const resolvedTargets = Object.entries(outcomes).flatMap(([targetThreadId, outcome]) =>
    outcome.kind === 'resolved' ? [{ threadId: targetThreadId, commitSha: outcome.commitSha }] : [],
  );
  const effectiveCommitSha = resolverCommitSha({
    threadIds,
    outcomes,
    pendingResolutions: pending,
    reportedSha: commitSha,
  });
  const actions = resolverActions({
    agent,
    status,
    turnState,
    commitSha: effectiveCommitSha,
    queuedThreadIds: pendingResolutions.map((resolution) => resolution.threadId),
    prNumber,
  });

  const queueTargets =
    resolvedTargets.length > 0
      ? resolvedTargets
      : effectiveCommitSha !== null
        ? threadIds.map((targetThreadId) => ({
            threadId: targetThreadId,
            commitSha: effectiveCommitSha,
          }))
        : [];

  const run = async (kind: ResolverActionKind) => {
    if (kind === 'push') {
      if (threadId === null || effectiveCommitSha === null) {
        return;
      }
      await resolveAgentThreads(sessionId, agent.id);
      return;
    }
    if (kind === 'queue') {
      if (prNumber === null) {
        return;
      }
      for (const target of queueTargets) {
        await queueResolution(sessionId, { ...target, prNumber });
      }
      return;
    }
    if (kind === 'dequeue') {
      for (const resolution of pendingResolutions) {
        await dequeueResolution(sessionId, resolution.threadId);
      }
      return;
    }
    if (kind === 'explain' || kind === 'forceResolve') {
      const trimmed = reason.trim();
      if (kind === 'explain' && trimmed === '') {
        return;
      }
      for (const targetThreadId of threadIds) {
        await resolveGithubThread(
          sessionId,
          targetThreadId,
          trimmed !== '' ? { reason: trimmed } : {},
        );
      }
      setReason('');
      return;
    }
    if (kind === 'proceed') {
      await sendTurn({ sessionId, agentId: agent.id, content: PROCEED_RESOLVER_PROMPT });
      return;
    }
    if (kind === 'continue') {
      await selectAgent(sessionId, agent.id);
      window.dispatchEvent(new CustomEvent('goodboy:focus-composer'));
      return;
    }
    if (kind === 'run') {
      await activateNextResolver(sessionId);
      return;
    }
    await forceCloseResolver(sessionId, agent.id);
  };

  const trigger = (action: ResolverAction) => {
    if (action.confirm === null) {
      void run(action.kind);
      return;
    }
    setReason('');
    setArmed(action.kind);
  };

  if (actions.length === 0) {
    return emptyNote === undefined ? null : (
      <p className="text-2xs italic text-muted-foreground/70">{emptyNote}</p>
    );
  }

  const armedAction = actions.find((action) => action.kind === armed) ?? null;
  const ArmedIcon = armedAction === null ? null : ICON[armedAction.kind];

  return (
    <div
      className={cn('flex min-w-0 flex-col gap-2', density === 'compact' && 'items-end')}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div
        className={cn(
          'flex flex-wrap items-center gap-1.5',
          density === 'compact' && 'justify-end',
        )}
      >
        {actions.map((action) => {
          const Icon = ICON[action.kind];
          return (
            <button
              key={action.kind}
              type="button"
              onClick={() => trigger(action)}
              disabled={!action.isEnabled}
              className={
                density === 'compact'
                  ? cn(COMPACT_CLASS, COMPACT_ROLE[action.role])
                  : cn(INSPECTOR_ACTION_CLASS, FULL_ROLE[action.role])
              }
            >
              <Icon size={9} aria-hidden />
              {action.label}
            </button>
          );
        })}
      </div>
      {armedAction !== null && armedAction.confirm !== null && ArmedIcon !== null && (
        <InlineConfirm
          role={armedAction.confirm.role}
          icon={<ArmedIcon size={12} aria-hidden />}
          title={armedAction.confirm.title}
          description={armedAction.confirm.description}
          confirmLabel={armedAction.confirm.confirmLabel}
          isConfirmDisabled={armedAction.reason === 'required' && reason.trim() === ''}
          className="w-full"
          note={
            armedAction.reason === null ? undefined : (
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                aria-label="resolution explanation"
                placeholder={
                  armedAction.reason === 'required'
                    ? 'Explain why this can be closed'
                    : 'Optional note'
                }
                autoGrow
                maxRows={6}
                className="min-h-12 resize-none bg-background/60 px-2 py-1.5 text-xs leading-relaxed"
              />
            )
          }
          onConfirm={async () => {
            await run(armedAction.kind);
            setArmed(null);
          }}
          onCancel={() => setArmed(null)}
        />
      )}
    </div>
  );
};
