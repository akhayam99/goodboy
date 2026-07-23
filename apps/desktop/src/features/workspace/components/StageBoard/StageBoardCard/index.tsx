import { memo } from 'react';
import {
  Archive,
  Bot,
  Code,
  RotateCcw,
  SquareTerminal,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { Chip, cn, Tooltip } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useNonResolverStandaloneAgents,
  useSessionCost,
  useSessionStageInfo,
} from '../../../../../store';
import { CostBadge } from '../../../../providers/components/CostBadge';
import { PullRequestChip, pullRequestMeta } from '../../../../github/components/PullRequestChip';
import { IntegrationGlyph } from '../../../../integrations/components/IntegrationGlyph';
import { ExternalTaskChip } from '../../../../integrations/components/ExternalTaskChip';
import type { BoardNavigation } from '../useBoardNavigation';
import { getLinkedRequest } from './getLinkedRequest';
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

  const pullRequest = useAppStore((s) => s.sessionGithub[id]?.pr ?? null);
  const mergeRequest = useAppStore((s) => s.sessionGitlabMr[id]?.mr ?? null);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks[id] ?? EMPTY_ARRAY);
  const agentCount = useNonResolverStandaloneAgents(id).length;
  const worktreePath = useAppStore((s) => s.sessionWorktrees[id]?.[0] ?? null);
  const dynamicActions = useDynamicActions(session, nav, stage);
  const sessionCost = useSessionCost(id);

  const linkedRequest = getLinkedRequest({ pullRequest, mergeRequest });
  const isGitlab = mergeRequest != null && pullRequest == null;
  const hasLinkedRequest = linkedRequest.state !== 'none';

  const prMeta = pullRequestMeta(linkedRequest.state);
  const prLabel =
    linkedRequest.title ??
    prMeta.label +
      (linkedRequest.number !== undefined
        ? isGitlab
          ? ` · !${linkedRequest.number}`
          : ` · #${linkedRequest.number}`
        : '');
  const prTooltip = prLabel + (isGitlab ? ', open in GitLab' : ', open in GitHub');

  const handlePrClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGitlab) {
      window.dispatchEvent(new CustomEvent('goodboy:open-gitlab-studio'));
    } else {
      nav.openGithub(session);
    }
  };

  return (
    <button
      type="button"
      data-archived={archived || undefined}
      onClick={() => nav.selectCard(session)}
      className={cn(
        'group flex h-[7.25rem] min-h-[7.25rem] shrink-0 gap-2 rounded-lg border bg-muted/40 p-3 text-left text-foreground/70 shadow-sm transition-colors hover:bg-muted/60 hover:text-foreground',
        stage === 'running'
          ? 'border-info/50'
          : stage === 'attention'
            ? 'border-warning/50'
            : 'border-transparent',
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex min-h-10 items-start gap-2">
          <Tooltip content={`${session.goal}${reason ? ` · ${reason}` : ''}`} side="top">
            <span className="line-clamp-2 min-h-10 min-w-0 flex-1 text-sm font-medium leading-snug">
              {session.goal}
            </span>
          </Tooltip>
          <span className="inline-flex h-5 shrink-0 items-center">
            {hasLinkedRequest ? (
              <Tooltip content={prTooltip} side="top">
                <button
                  type="button"
                  aria-label={prTooltip}
                  onClick={handlePrClick}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-sm transition-colors hover:bg-muted"
                >
                  <IntegrationGlyph provider={isGitlab ? 'gitlab' : 'github'} size="xs" />
                  <PullRequestChip
                    state={linkedRequest.state}
                    variant="icon"
                    number={linkedRequest.number}
                    iconSize={12}
                    title={linkedRequest.title}
                  />
                </button>
              </Tooltip>
            ) : (
              <PullRequestChip
                state={linkedRequest.state}
                variant="icon"
                number={linkedRequest.number}
                iconSize={12}
                title={linkedRequest.title}
              />
            )}
          </span>
        </span>

        <span className="mt-auto flex min-h-5 flex-nowrap items-center gap-1.5 overflow-hidden">
          {agentCount > 0 && (
            <Tooltip content={`${agentCount} agents`} side="top">
              <span
                aria-label={`${agentCount} agents`}
                className="inline-flex shrink-0 items-center gap-1 text-2xs text-muted-foreground"
              >
                <Bot size={12} aria-hidden />
                <span className="tabular-nums">{agentCount}</span>
              </span>
            </Tooltip>
          )}
          {externalTasks.map((task) => (
            <ExternalTaskChip
              key={`${task.provider}:${task.externalId}`}
              task={task}
              variant="icon"
            />
          ))}
          {sessionCost > 0 && (
            <CostBadge
              value={sessionCost}
              title={`session spend: $${sessionCost.toFixed(2)} (excludes summarizer)`}
              className="shrink-0 text-2xs font-medium tabular-nums text-muted-foreground"
            />
          )}
          {isAutoMode && <Chip tone="danger" size="sm" label="auto" className="shrink-0" />}
        </span>
      </span>

      <span className="-mr-1 flex shrink-0 flex-col items-end gap-1">
        {!archived && dynamicActions.length > 0 && (
          <span className="flex flex-wrap justify-end gap-0.5">
            {dynamicActions.map((action) => (
              <CardAction
                key={action.key}
                icon={action.icon}
                hoverColor={action.color}
                label={action.label}
                onClick={action.onClick}
              />
            ))}
          </span>
        )}
        <span className="mt-auto flex flex-col items-end gap-0.5">
          {archived ? (
            <span className="flex gap-0.5">
              <CardAction
                icon={RotateCcw}
                hoverColor="text-primary"
                label="restore"
                onClick={() => onRestore?.(session)}
              />
              <CardAction
                icon={Trash2}
                hoverColor="text-danger"
                label="delete"
                onClick={() => onDelete?.(session)}
              />
            </span>
          ) : (
            <>
              <span className="flex gap-0.5">
                <CardAction
                  icon={Code}
                  hoverColor="text-muted-foreground"
                  label="open in editor"
                  onClick={() => nav.openIDE(session)}
                  disabled={!worktreePath}
                />
                <CardAction
                  icon={SquareTerminal}
                  hoverColor="text-muted-foreground"
                  label="open terminal"
                  onClick={() => nav.openTerminal(session)}
                />
              </span>
              <span className="flex gap-0.5">
                <CardAction
                  icon={Archive}
                  hoverColor="text-muted-foreground"
                  label="archive"
                  onClick={() => onArchive?.(session)}
                />
                <CardAction
                  icon={Trash2}
                  hoverColor="text-danger"
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

const ACTION_HOVER: Record<string, string> = {
  'text-primary': 'hover:text-primary',
  'text-danger': 'hover:text-danger',
  'text-warning': 'hover:text-warning',
  'text-info': 'hover:text-info',
  'text-success': 'hover:text-success',
  'text-muted-foreground': 'hover:text-muted-foreground',
};

type CardActionProps = {
  readonly icon: LucideIcon;
  readonly hoverColor: string;
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
};

const CardAction = ({ icon: Icon, hoverColor, label, onClick, disabled }: CardActionProps) => {
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
        className={cn(
          'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40',
          ACTION_HOVER[hoverColor] ?? hoverColor,
        )}
      >
        <Icon size={14} aria-hidden />
      </button>
    </Tooltip>
  );
};
