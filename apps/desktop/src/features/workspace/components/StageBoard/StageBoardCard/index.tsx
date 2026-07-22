import { memo } from 'react';
import { Archive, Code, RotateCcw, SquareTerminal, Trash2, type LucideIcon } from 'lucide-react';
import { Chip, cn, StatusDot, Tooltip } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useNonResolverStandaloneAgents,
  useSessionCost,
  useSessionStageInfo,
} from '../../../../../store';
import { SESSION_STAGE_META, STAGE_TONE } from '../../../../session/session-stage';
import { CostBadge } from '../../../../providers/components/CostBadge';
import { PullRequestChip } from '../../../../github/components/PullRequestChip';
import { ExternalTaskChip } from '../../../../integrations/components/ExternalTaskChip';
import { pluralize } from '../../WorkspacesSidebar/lib';
import type { BoardNavigation } from '../useBoardNavigation';
import { useDynamicActions } from './useDynamicActions';

type StageBoardCardProps = {
  readonly session: Session;
  readonly nav: BoardNavigation;
  readonly archived?: boolean;
  readonly onArchive?: (session: Session) => void;
  readonly onDelete?: (session: Session) => void;
  readonly onRestore?: (session: Session) => void;
};

export const StageBoardCard = memo(function StageBoardCard({
  session,
  nav,
  archived,
  onArchive,
  onDelete,
  onRestore,
}: StageBoardCardProps) {
  const id = session.id as SessionId;
  const { stage, reason } = useSessionStageInfo(session);
  const isAutoMode =
    stage === 'running' && session.workflowRuns.some((r) => r.autoRun && !r.discardedAt);

  const prState = useAppStore((s) => s.sessionGithub[id]?.pr?.state ?? null);
  const prNumber = useAppStore((s) => s.sessionGithub[id]?.pr?.number);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks[id] ?? EMPTY_ARRAY);
  const agentCount = useNonResolverStandaloneAgents(id).length;
  const worktreePath = useAppStore((s) => s.sessionWorktrees[id]?.[0] ?? null);
  const dynamicActions = useDynamicActions(session, nav, stage, reason);
  const sessionCost = useSessionCost(id);

  const stageMeta = SESSION_STAGE_META[stage];

  return (
    <button
      type="button"
      data-archived={archived || undefined}
      onClick={() => nav.selectCard(session)}
      className={cn(
        'group flex min-h-[7.25rem] shrink-0 gap-2 rounded-lg border bg-muted/40 p-3 text-left text-foreground/70 shadow-sm transition-colors hover:bg-muted/60 hover:text-foreground',
        stage === 'running'
          ? 'border-info/50'
          : stage === 'attention'
            ? 'border-warning/50'
            : 'border-transparent',
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex items-start gap-2">
          <span className="inline-flex h-5 shrink-0 items-center">
            <StatusDot
              tone={isAutoMode ? 'danger' : STAGE_TONE[stage]}
              size="sm"
              pulsing={stage === 'running'}
              ariaLabel={stageMeta.label}
            />
          </span>
          <Tooltip content={`${session.goal}${reason ? ` · ${reason}` : ''}`} side="top">
            <span className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-snug">
              {session.goal}
            </span>
          </Tooltip>
        </span>

        {reason && <span className="truncate text-2xs text-muted-foreground">{reason}</span>}

        {(sessionCost > 0 ||
          prState != null ||
          externalTasks.length > 0 ||
          agentCount > 0 ||
          isAutoMode) && (
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
            {externalTasks.map((task) => (
              <ExternalTaskChip
                key={`${task.provider}:${task.externalId}`}
                task={task}
                variant="badge"
              />
            ))}
            {agentCount > 0 && (
              <Chip tone="neutral" size="sm" shape="pill" label={pluralize(agentCount, 'agent')} />
            )}
            {isAutoMode && <Chip tone="danger" size="sm" label="auto" />}
          </span>
        )}
      </span>

      <span className="-mr-1 flex shrink-0 flex-col items-end gap-1">
        {!archived && dynamicActions.length > 0 && (
          <span className="flex flex-wrap justify-end gap-0.5">
            {dynamicActions.map((action) => (
              <CardAction
                key={action.key}
                icon={action.icon}
                color={action.color}
                label={action.label}
                onClick={action.onClick}
              />
            ))}
          </span>
        )}
        <span className="mt-auto flex flex-col items-end gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:opacity-100">
          {archived ? (
            <span className="flex gap-0.5">
              <CardAction
                icon={RotateCcw}
                color="text-primary"
                label="restore"
                onClick={() => onRestore?.(session)}
              />
              <CardAction
                icon={Trash2}
                color="text-danger"
                label="delete"
                onClick={() => onDelete?.(session)}
              />
            </span>
          ) : (
            <>
              <span className="flex gap-0.5">
                <CardAction
                  icon={Code}
                  color="text-muted-foreground"
                  label="open in editor"
                  onClick={() => nav.openIDE(session)}
                  disabled={!worktreePath}
                />
                <CardAction
                  icon={SquareTerminal}
                  color="text-muted-foreground"
                  label="open terminal"
                  onClick={() => nav.openTerminal(session)}
                />
              </span>
              <span className="flex gap-0.5">
                <CardAction
                  icon={Archive}
                  color="text-muted-foreground"
                  label="archive"
                  onClick={() => onArchive?.(session)}
                />
                <CardAction
                  icon={Trash2}
                  color="text-danger"
                  label="delete"
                  onClick={() => onDelete?.(session)}
                />
              </span>
            </>
          )}
        </span>
      </span>
    </button>
  );
});

type CardActionProps = {
  readonly icon: LucideIcon;
  readonly color: string;
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
};

const CardAction = ({ icon: Icon, color, label, onClick, disabled }: CardActionProps) => {
  return (
    <Tooltip content={label} side="top">
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="inline-flex size-7 items-center justify-center rounded-md transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
      >
        <Icon size={14} className={color} aria-hidden />
      </button>
    </Tooltip>
  );
};
