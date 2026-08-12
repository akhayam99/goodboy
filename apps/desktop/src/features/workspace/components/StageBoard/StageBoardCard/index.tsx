import { memo, useEffect, useMemo } from 'react';
import {
  Archive,
  Bot,
  ChevronRight,
  Code,
  MessageSquareDiff,
  RotateCcw,
  SquareTerminal,
  Trash2,
} from 'lucide-react';
import { Chip, cn, Divider, formatUsd, tintClasses, Tooltip } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useNonResolverStandaloneAgents,
  useSessionCost,
  useSessionPrFetchState,
  useSessionStageInfo,
} from '../../../../../store';
import { isPrReviewSession } from '../../../../../store/slices/session-view';
import { CostBadge } from '../../../../providers/components/CostBadge';
import { ExternalTaskChip } from '../../../../integrations/components/ExternalTaskChip';
import { CardAction } from '../../../../../shared/components/CardAction';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { STAGE_TONE } from '../../../../session/session-stage';
import { CardActionSlot } from '../../../../../shared/components/CardActionSlot';
import { sessionCardShell } from '../../../../session/components/sessionCardShell';
import { formatRelativeAge } from '../../../../../shared/utils/relativeDate';
import type { BoardNavigation } from '../useBoardNavigation';
import { getLinkedRequest } from './getLinkedRequest';
import { PrRequestSlot } from './PrRequestSlot';
import { useDynamicActions } from './useDynamicActions';

const draftTint = tintClasses('draft');

type CardSelectionEvent = {
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
};

type StageBoardCardProps = {
  readonly session: Session;
  readonly nav: BoardNavigation;
  readonly archived?: boolean;
  readonly selected?: boolean;
  readonly onModifierClick?: (id: SessionId, event: CardSelectionEvent) => void;
  readonly onArchive?: (session: Session) => void;
  readonly onDelete?: (session: Session) => void;
  readonly onRestore?: (session: Session) => void;
};

export const StageBoardCard = memo(function StageBoardCard({
  session,
  nav,
  archived,
  selected,
  onModifierClick,
  onArchive,
  onDelete,
  onRestore,
}: StageBoardCardProps) {
  const id = session.id as SessionId;
  const { stage, reason } = useSessionStageInfo(session);
  const isAutoMode =
    stage === 'running' && session.workflowRuns.some((r) => r.autoRun && !r.discardedAt);

  const pullRequest = useAppStore((s) => s.sessionGithub[id]?.pr ?? null);
  const prFetchState = useSessionPrFetchState(id);
  const mergeRequest = useAppStore((s) => s.sessionGitlabMr[id]?.mr ?? null);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks[id] ?? EMPTY_ARRAY);
  const agentCount = useNonResolverStandaloneAgents(id).length;
  const agentCountLabel = `${agentCount} ${agentCount === 1 ? 'agent' : 'agents'}`;
  const worktreePath = useAppStore((s) => s.sessionWorktrees[id]?.[0] ?? null);
  const dynamicActions = useDynamicActions(session, nav, stage);
  const sessionCost = useSessionCost(id);
  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[id] ?? EMPTY_ARRAY);
  const isPrReview = useMemo(() => isPrReviewSession({ agents: phaseRuns }), [phaseRuns]);
  const reviewDrafts = useAppStore((s) => s.reviewDrafts[id]);
  const loadReviewDrafts = useAppStore((s) => s.loadReviewDrafts);

  useEffect(() => {
    if (!isPrReview || reviewDrafts != null) {
      return;
    }
    void loadReviewDrafts(id);
  }, [isPrReview, reviewDrafts, loadReviewDrafts, id]);

  const reviewDraftCount = isPrReview
    ? (reviewDrafts ?? []).filter((draft) => draft.status === 'draft').length
    : 0;

  const age = formatRelativeAge({ fromIso: session.updatedAt });
  const linkedRequest = getLinkedRequest({ pullRequest, mergeRequest });
  const isGitlab = mergeRequest != null && pullRequest == null;

  const handlePrClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGitlab) {
      window.dispatchEvent(new CustomEvent('goodboy:open-gitlab-studio'));
    } else {
      nav.openGithub(session);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      data-archived={archived || undefined}
      data-select-id={id}
      aria-pressed={selected === true}
      aria-keyshortcuts="Alt+Enter"
      onClick={(event) => {
        if (onModifierClick && (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey)) {
          onModifierClick(id, event);
          return;
        }
        nav.selectCard(session);
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        event.preventDefault();
        if (onModifierClick && event.altKey) {
          onModifierClick(id, event);
          return;
        }
        nav.selectCard(session);
      }}
      className={cn(
        'group/session-card grid h-[8.25rem] min-h-[8.25rem] shrink-0 cursor-pointer grid-cols-[minmax(0,1fr)_auto] grid-rows-[1fr_auto] gap-2 p-3 text-left shadow-sm',
        sessionCardShell({ stage, selected }),
      )}
    >
      <span className="row-span-2 flex min-w-0 flex-col justify-between gap-2">
        <span className="flex min-h-10 items-start gap-1.5">
          <PrRequestSlot
            linkedRequest={linkedRequest}
            isGitlab={isGitlab}
            prFetchState={prFetchState}
            onOpen={handlePrClick}
          />
          <Tooltip content={`${session.goal}${reason ? ` · ${reason}` : ''}`} side="top">
            <span className="line-clamp-2 min-h-10 min-w-0 flex-1 text-sm font-medium leading-snug">
              {session.goal}
            </span>
          </Tooltip>
        </span>

        {reason && (
          <span className="truncate text-2xs leading-tight text-muted-foreground/60">{reason}</span>
        )}

        <span className="flex min-h-5 flex-nowrap items-center gap-1.5 overflow-hidden">
          {agentCount > 0 && (
            <Tooltip content={agentCountLabel} side="top">
              <span
                aria-label={agentCountLabel}
                className="inline-flex shrink-0 items-center gap-1 text-2xs text-muted-foreground"
              >
                <Bot size={14} aria-hidden />
                <span className="tabular-nums">{agentCount}</span>
              </span>
            </Tooltip>
          )}
          {reviewDraftCount > 0 && (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-3xs font-medium',
                draftTint.bg,
                draftTint.text,
              )}
            >
              <MessageSquareDiff size={10} aria-hidden />
              <span className="tabular-nums">{reviewDraftCount}</span>
              <span>draft {reviewDraftCount === 1 ? 'comment' : 'comments'}</span>
            </span>
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
              title={`Session spend: ${formatUsd(sessionCost)} (excludes summarizer)`}
              className="shrink-0 text-2xs font-medium tabular-nums text-muted-foreground"
            />
          )}
          {isAutoMode && (
            <Chip
              tone={CONCEPT_TONE.autorun}
              size="sm"
              icon={<CONCEPT_ICONS.autorun size={10} aria-hidden />}
              label="Autorun"
              className="shrink-0"
            />
          )}
          {age && (
            <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/50">{age}</span>
          )}
          <ChevronRight
            size={13}
            aria-hidden
            className="ml-auto shrink-0 text-muted-foreground/40 group-hover/session-card:text-muted-foreground/70"
          />
        </span>
      </span>

      <CardActionSlot
        label="Session quick actions"
        className="col-start-2 row-start-1 flex-col items-end self-start"
      >
        {!archived && (
          <span className="flex flex-nowrap justify-end gap-1">
            {dynamicActions.map((action) => (
              <CardAction
                key={action.key}
                icon={action.icon}
                tone={action.tone}
                highlighted={action.tone === STAGE_TONE.attention}
                label={action.label}
                onClick={action.onClick}
              />
            ))}
            <CardAction
              icon={Code}
              label="Open in editor"
              onClick={() => nav.openIDE(session)}
              disabled={worktreePath == null}
            />
            <CardAction
              icon={SquareTerminal}
              label="Open terminal"
              onClick={() => nav.openTerminal(session)}
            />
          </span>
        )}
      </CardActionSlot>

      <CardActionSlot
        label="Session lifecycle actions"
        className="col-start-2 row-start-2 self-end"
      >
        {archived ? (
          <CardAction
            icon={RotateCcw}
            tone="primary"
            label="Restore"
            onClick={() => onRestore?.(session)}
          />
        ) : (
          <CardAction icon={Archive} label="Archive" onClick={() => onArchive?.(session)} />
        )}
        <Divider orientation="vertical" className="mx-0.5 h-4 shrink-0 self-center" />
        <CardAction
          icon={Trash2}
          tone="danger"
          label="Delete"
          onClick={() => onDelete?.(session)}
        />
      </CardActionSlot>
    </div>
  );
});
