import { memo, useMemo } from 'react';
import { Code, GitCompare, MessagesSquare, SquareTerminal } from 'lucide-react';
import { Button, Chip, cn, StatusDot } from '@goodboy/ui';
import type { Session, SessionId, TelemetryRecord } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionHasUnread,
  useSessionStageInfo,
} from '../../../../../store';
import { SESSION_STAGE_META, STAGE_TONE } from '../../../../session/session-stage';
import { CostBadge } from '../../../../providers/components/CostBadge';
import { PullRequestChip } from '../../../../github/components/PullRequestChip';
import { ExternalTaskChip } from '../../../../integrations/components/ExternalTaskChip';
import type { BoardNavigation } from '../useBoardNavigation';

type StageBoardCardProps = {
  readonly session: Session;
  readonly nav: BoardNavigation;
};

export const StageBoardCard = memo(function StageBoardCard({ session, nav }: StageBoardCardProps) {
  const id = session.id as SessionId;
  const { stage, reason } = useSessionStageInfo(session);
  const isAutoMode =
    stage === 'running' && session.workflowRuns.some((r) => r.autoRun && !r.discardedAt);

  const prState = useAppStore((s) => s.sessionGithub[id]?.pr?.state ?? null);
  const prNumber = useAppStore((s) => s.sessionGithub[id]?.pr?.number);
  const externalTask = useAppStore((s) => s.sessionExternalTasks?.[id] ?? null);
  const agentCount = useAppStore((s) => (s.sessionPhaseRuns[id] ?? EMPTY_ARRAY).length);
  const worktreePath = useAppStore((s) => s.sessionWorktrees[id]?.[0] ?? null);
  useSessionHasUnread(id);

  const telemetry = useAppStore(
    (s) => s.sessionTelemetry[id] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  );
  const sessionCost = useMemo(() => {
    let sum = 0;
    for (const rec of telemetry) {
      if (rec.kind === 'summarizer') {
        continue;
      }
      sum += rec.estimatedCostUsd;
    }
    return sum;
  }, [telemetry]);

  const stageMeta = SESSION_STAGE_META[stage];

  return (
    <button
      type="button"
      onClick={() => nav.selectCard(session)}
      title={`${session.goal}${reason ? ` · ${reason}` : ''}`}
      className={cn(
        'group flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 text-left text-foreground/70 shadow-sm transition-colors hover:bg-muted/60 hover:text-foreground',
        stage === 'running'
          ? isAutoMode
            ? 'border-danger/50'
            : 'border-info/50'
          : stage === 'attention'
            ? 'border-warning/50'
            : 'border-transparent',
      )}
    >
      <span className="flex w-full items-start gap-2">
        <StatusDot
          tone={isAutoMode ? 'danger' : STAGE_TONE[stage]}
          size="sm"
          pulsing={stage === 'running'}
          ariaLabel={stageMeta.label}
          className="mt-[3px]"
        />
        <span className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-snug">
          {session.goal}
        </span>
      </span>

      {reason && <span className="truncate text-2xs text-muted-foreground">{reason}</span>}

      {(sessionCost > 0 || prState || externalTask || agentCount > 0 || isAutoMode) && (
        <span className="flex flex-wrap items-center gap-1.5">
          {sessionCost > 0 && (
            <CostBadge
              value={sessionCost}
              title={`session spend: $${sessionCost.toFixed(2)} (excludes summarizer)`}
              className="text-2xs font-medium tabular-nums text-muted-foreground"
            />
          )}
          {prState && (
            <PullRequestChip state={prState} variant="icon" number={prNumber} iconSize={12} />
          )}
          {externalTask && <ExternalTaskChip task={externalTask} variant="icon" />}
          {agentCount > 0 && (
            <Chip tone="neutral" size="sm" shape="pill" label={`${agentCount} agents`} />
          )}
          {isAutoMode && <Chip tone="danger" size="sm" label="auto" />}
        </span>
      )}

      <span className="-mb-1 -ml-1 flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:opacity-100">
        <CardAction
          icon={<MessagesSquare size={14} aria-hidden />}
          label="open agent"
          onClick={() => nav.openAgent(session)}
        />
        <CardAction
          icon={<GitCompare size={14} aria-hidden />}
          label="open diff"
          onClick={() => nav.openDiff(session)}
        />
        <CardAction
          icon={<SquareTerminal size={14} aria-hidden />}
          label="open terminal"
          onClick={() => nav.openTerminal(session)}
        />
        <CardAction
          icon={<Code size={14} aria-hidden />}
          label="open in editor"
          onClick={() => nav.openIDE(session)}
          disabled={!worktreePath}
        />
      </span>
    </button>
  );
});

type CardActionProps = {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
};

const CardAction = ({ icon, label, onClick, disabled }: CardActionProps) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="size-7 p-0 text-muted-foreground/70 hover:text-foreground"
    >
      {icon}
    </Button>
  );
};
