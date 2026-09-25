import { memo, useEffect, useMemo } from 'react';
import { Archive, ChevronRight, Code, MessageSquareDiff, Trash2 } from 'lucide-react';
import {
  Chip,
  cn,
  formatUsd,
  Tooltip,
  InlineMarkdown,
  inlineMarkdownText,
  OverflowMenu,
  type OverflowMenuItem,
} from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionPrFetchState } from '../../../../../store';
import { useSessionSummary } from '../../../hooks/useSessionSummary';
import { SessionProgress } from '../../SessionProgress';
import { isPrReviewSession } from '../../../../../store/slices/session-view';
import { CostBadge } from '../../../../providers/components/CostBadge';
import { ExternalTaskChip } from '../../../../integrations/components/ExternalTaskChip';
import { CardAction, CardActionSlot } from '@goodboy/ui';
import {
  CONCEPT_ICONS,
  CONCEPT_TONE,
  ICON_SIZE,
} from '../../../../../shared/components/conceptIcons';
import { sessionCardShell } from '../../../../session/components/sessionCardShell';
import { useOpenSession } from '../../../../../shared/hooks/useOpenSession';
import type { BoardNavigation } from '../useBoardNavigation';
import { getLinkedRequest } from './getLinkedRequest';
import { PrRequestSlot } from './PrRequestSlot';
import { ProjectMountChips } from './ProjectMountChips';
import { useDynamicActions, type DynamicAction } from './useDynamicActions';

const SESSION_CARD_REVEAL =
  'opacity-0 group-hover/session-card:opacity-100 group-focus-within/session-card:opacity-100 aria-expanded:opacity-100';

const isUrgent = ({ tone }: { readonly tone: DynamicAction['tone'] }): boolean =>
  tone === 'warning' || tone === 'danger';

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
  const summary = useSessionSummary({ session });
  const { stage, reason, attention, progress, agentCount, age } = summary;
  const externalTasks = summary.tasks;
  const sessionCost = summary.cost;
  const isAutoMode = summary.isAutorun;

  const pullRequest = useAppStore((s) => s.sessionGithub[id]?.pr ?? null);
  const prFetchState = useSessionPrFetchState(id);
  const mergeRequest = useAppStore((s) => s.sessionGitlabMr[id]?.mr ?? null);
  const agentCountLabel = `${agentCount} ${agentCount === 1 ? 'agent' : 'agents'}`;
  const worktreePath = useAppStore((s) => s.sessionWorktrees[id]?.[0] ?? null);
  const mounts = useAppStore((s) => s.sessionProjectMounts?.[id] ?? EMPTY_ARRAY);
  const workspaceProjectCount = useAppStore(
    (s) =>
      (s.projects ?? EMPTY_ARRAY).filter((project) => project.workspaceId === session.workspaceId)
        .length,
  );
  const showProjectChips = workspaceProjectCount > 1 && mounts.length > 0;
  const dynamicActions = useDynamicActions(session, nav, stage);
  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[id] ?? EMPTY_ARRAY);
  const isPrReview = useMemo(() => isPrReviewSession({ agents: phaseRuns }), [phaseRuns]);
  const reviewDrafts = useAppStore((s) => s.reviewDrafts[id]);
  const loadReviewDrafts = useAppStore((s) => s.loadReviewDrafts);
  const openSession = useOpenSession();

  useEffect(() => {
    if (!isPrReview || reviewDrafts != null) {
      return;
    }
    void loadReviewDrafts(id);
  }, [isPrReview, reviewDrafts, loadReviewDrafts, id]);

  const reviewDraftCount = isPrReview
    ? (reviewDrafts ?? []).filter((draft) => draft.status === 'draft').length
    : 0;

  const [visibleAction, ...revealedActions] = dynamicActions;
  const linkedRequest = getLinkedRequest({ pullRequest, mergeRequest });
  const isGitlab = mergeRequest != null && pullRequest == null;
  const lifecycleItems: ReadonlyArray<OverflowMenuItem> = [
    ...(archived === true
      ? []
      : [
          {
            kind: 'item',
            key: 'editor',
            label: 'Open in editor',
            icon: Code,
            onClick: () => nav.openIDE(session),
            disabled: worktreePath == null,
          } satisfies OverflowMenuItem,
          {
            kind: 'item',
            key: 'terminal',
            label: 'Open terminal',
            icon: CONCEPT_ICONS.terminal,
            onClick: () => nav.openTerminal(session),
          } satisfies OverflowMenuItem,
          ...revealedActions.map((action): OverflowMenuItem => ({
            kind: 'item',
            key: action.key,
            label: action.label,
            icon: action.icon,
            onClick: action.onClick,
          })),
          { kind: 'separator', key: 'lifecycle-separator' } satisfies OverflowMenuItem,
          {
            kind: 'item',
            key: 'archive',
            label: 'Archive',
            icon: Archive,
            onClick: () => onArchive?.(session),
          } satisfies OverflowMenuItem,
        ]),
    {
      kind: 'item',
      key: 'delete',
      label: 'Delete',
      icon: Trash2,
      destructive: true,
      onClick: () => onDelete?.(session),
    },
  ];

  const handlePrClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mergeRequest != null && pullRequest == null) {
      window.dispatchEvent(
        new CustomEvent('goodboy:open-inbox', {
          detail: {
            provider: 'gitlab',
            kind: 'mr',
            recordKey: `gitlab:mr:${mergeRequest.id}`,
          },
        }),
      );
      return;
    }
    nav.openGithub(session);
  };

  const selectFromEvent = (event: CardSelectionEvent): boolean => {
    if (onModifierClick && (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey)) {
      onModifierClick(id, event);
      return true;
    }
    return false;
  };

  return (
    <article
      data-archived={archived || undefined}
      data-select-id={id}
      onClick={(event) => {
        if (selectFromEvent(event)) {
          return;
        }
        nav.selectCard(session);
      }}
      className={cn(
        'group/session-card grid h-28 shrink-0 cursor-pointer grid-cols-[minmax(0,1fr)_auto] grid-rows-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 p-3 text-left',
        sessionCardShell({ stage, attention, selected }),
      )}
    >
      <span className="flex min-w-0 flex-col justify-between">
        <span className="flex min-h-10 items-start gap-2">
          <PrRequestSlot
            linkedRequest={linkedRequest}
            isGitlab={isGitlab}
            prFetchState={prFetchState}
            onOpen={handlePrClick}
          />
          <button
            type="button"
            title={inlineMarkdownText({ text: session.goal })}
            aria-pressed={selected === true}
            aria-keyshortcuts="Alt+Enter"
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              if (event.altKey && selectFromEvent(event)) {
                return;
              }
              nav.selectCard(session);
            }}
            className="min-w-0 flex-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <InlineMarkdown
              text={session.goal}
              className="line-clamp-2 min-h-10 text-sm font-medium leading-5"
            />
          </button>
        </span>

        {progress !== null ? (
          <SessionProgress progress={progress} tone={summary.tone} />
        ) : reason !== '' ? (
          <span className="truncate text-2xs text-muted-foreground">{reason}</span>
        ) : null}
      </span>

      <span className="col-start-2 row-start-1 flex items-center gap-1 self-start">
        <CardActionSlot label="Session quick actions">
          {!archived && visibleAction !== undefined && (
            <CardAction
              key={visibleAction.key}
              icon={visibleAction.icon}
              tone={visibleAction.tone}
              highlighted={isUrgent({ tone: visibleAction.tone })}
              label={visibleAction.label}
              onClick={visibleAction.onClick}
            />
          )}
          {archived === true && (
            <CardAction
              icon={CONCEPT_ICONS.restore}
              tone="primary"
              label="Restore"
              onClick={() => onRestore?.(session)}
            />
          )}
          <OverflowMenu
            items={lifecycleItems}
            label="Session actions"
            trigger={<CONCEPT_ICONS.more size={ICON_SIZE.row} aria-hidden />}
            triggerClassName={SESSION_CARD_REVEAL}
          />
        </CardActionSlot>
        <ChevronRight
          size={ICON_SIZE.row}
          aria-hidden
          className="shrink-0 text-faint-foreground group-hover/session-card:text-faint-foreground"
        />
      </span>

      <span className="col-span-2 col-start-1 row-start-2 flex h-5 min-w-0 items-center gap-2">
        <span className="flex min-w-0 items-center gap-2 overflow-hidden">
          {agentCount > 0 && (
            <Tooltip content={agentCountLabel} side="top">
              <span
                aria-label={agentCountLabel}
                className="inline-flex shrink-0 items-center gap-1 text-3xs tabular-nums text-faint-foreground"
              >
                <CONCEPT_ICONS.agents size={ICON_SIZE.row} aria-hidden />
                <span>{agentCount}</span>
              </span>
            </Tooltip>
          )}
          {reviewDraftCount > 0 && (
            <Chip
              tone="draft"
              size="xs"
              bordered={false}
              ariaLabel={`Review ${reviewDraftCount} draft ${reviewDraftCount === 1 ? 'comment' : 'comments'}`}
              onClick={(event) => {
                event.stopPropagation();
                openSession({ sessionId: id, lens: 'review' });
              }}
              icon={<MessageSquareDiff size={10} aria-hidden />}
              label={<span className="tabular-nums">{reviewDraftCount}</span>}
              trailing={<span>draft {reviewDraftCount === 1 ? 'comment' : 'comments'}</span>}
              className="shrink-0"
            />
          )}
          {isAutoMode && (
            <Tooltip content="Autorun" side="top">
              <span className="inline-flex shrink-0">
                <Chip
                  tone={CONCEPT_TONE.autorun}
                  size="xs"
                  bordered={false}
                  ariaLabel="Autorun"
                  icon={<CONCEPT_ICONS.autorun size={ICON_SIZE.row} aria-hidden />}
                />
              </span>
            </Tooltip>
          )}
          {showProjectChips ? <ProjectMountChips mounts={mounts} /> : null}
          {externalTasks.map((task) => (
            <ExternalTaskChip
              key={`${task.provider}:${task.externalId}`}
              task={task}
              variant="icon"
            />
          ))}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {sessionCost > 0 && (
            <CostBadge
              value={sessionCost}
              title={`Session spend: ${formatUsd(sessionCost)} (excludes summarizer)`}
              className="shrink-0 text-3xs tabular-nums text-faint-foreground"
            />
          )}
          {age && (
            <span className="shrink-0 text-3xs tabular-nums text-faint-foreground">{age}</span>
          )}
        </span>
      </span>
    </article>
  );
});
