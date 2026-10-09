import { memo, useEffect, useMemo } from 'react';
import { ChevronRight, MessageSquareDiff, Pin } from 'lucide-react';
import {
  Chip,
  cn,
  formatUsd,
  Input,
  SelectionCheckbox,
  Tooltip,
  InlineMarkdown,
  inlineMarkdownText,
  ToneBar,
} from '@goodboy/ui';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';
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
import { sessionCardShell, sessionTone } from '../../../../session/components/sessionCardShell';
import { branchPlace } from '../../../../../store/slices/navigation/place';
import { NAMES } from '../../../../../shared/names';
import { sessionDisplayTitle } from '../../../../session/sessionTitle';
import { ChatOriginGlyph } from '../../../../../shared/components/ChatOriginGlyph';
import type { BoardNavigation } from '../useBoardNavigation';
import { getLinkedRequest } from './getLinkedRequest';
import { PrRequestSlot } from './PrRequestSlot';
import { ProjectMountChips } from './ProjectMountChips';
import { useDynamicActions } from './useDynamicActions';
import { ObjectOverflowMenu } from '../../../../actions/components/ObjectOverflowMenu';
import { useObjectMenuTrigger } from '../../../../actions/useObjectMenuTrigger';
import { useRenameRequest } from '../../../../actions/useRenameRequest';
import { sessionObjectKey } from '../../../../actions/kinds/session';
import { sessionSelectionTarget } from '../../../../actions/sessionSelectionTarget';
import { useSessionTitleRename } from '../../../../session/hooks/useSessionTitleRename';

const SESSION_CARD_REVEAL =
  'opacity-0 group-hover/session-card:opacity-100 group-focus-within/session-card:opacity-100 aria-expanded:opacity-100';

const RAIL_UNDER_CHECKBOX =
  'group-hover/select-row:top-9 group-focus-within/select-row:top-9 group-data-[selecting=true]/select-list:top-9';

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
  readonly getSelectedIds?: () => ReadonlyArray<SessionId>;
  readonly onClearSelection?: () => void;
  readonly onModifierClick?: (id: SessionId, event: CardSelectionEvent) => void;
  readonly onToggleSelect?: (id: SessionId, event: { readonly shiftKey: boolean }) => void;
  readonly onRestore?: (session: Session) => void;
};

const NO_SELECTION: ReadonlyArray<SessionId> = [];
const noSelectedIds = (): ReadonlyArray<SessionId> => NO_SELECTION;

export const StageBoardCard = memo(function StageBoardCard({
  session,
  nav,
  archived,
  selected,
  getSelectedIds = noSelectedIds,
  onClearSelection,
  onModifierClick,
  onToggleSelect,
  onRestore,
}: StageBoardCardProps) {
  const id = session.id as SessionId;
  const summary = useSessionSummary({ session });
  const { stage, reason, attention, isRunning, progress, agentCount, age } = summary;
  const externalTasks = summary.tasks;
  const sessionCost = summary.cost;
  const isAutoMode = summary.isAutorun;
  const title = sessionDisplayTitle({ session, tasks: externalTasks });

  const pullRequest = useAppStore((s) => s.sessionGithub[id]?.pr ?? null);
  const prFetchState = useSessionPrFetchState(id);
  const mergeRequest = useAppStore((s) => s.sessionGitlabMr[id]?.mr ?? null);
  const agentCountLabel = `${agentCount} ${agentCount === 1 ? 'agent' : 'agents'}`;
  const mounts = useAppStore((s) => s.sessionProjectMounts?.[id] ?? EMPTY_ARRAY);
  const isPinned = useAppStore((s) =>
    (s.sessionPins?.[session.workspaceId as WorkspaceId] ?? EMPTY_ARRAY).some(
      (pin) => pin.id === id,
    ),
  );
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
  const navigate = useAppStore((s) => s.navigate);

  useEffect(() => {
    if (!isPrReview || reviewDrafts != null) {
      return;
    }
    void loadReviewDrafts(id);
  }, [isPrReview, reviewDrafts, loadReviewDrafts, id]);

  const reviewDraftCount = isPrReview
    ? (reviewDrafts ?? []).filter((draft) => draft.status === 'draft').length
    : 0;

  const [visibleAction] = dynamicActions;
  const anchorKey = `board:${id}`;
  const rename = useSessionTitleRename({ sessionId: id, currentTitle: session.goal });
  useRenameRequest({
    objectKey: sessionObjectKey({ sessionId: id }),
    anchorKeys: [anchorKey],
    onRename: rename.start,
  });
  const menu = useObjectMenuTrigger({
    target: { kind: 'session', sessionId: id },
    anchorKey,
    onBeforeOpen: () =>
      sessionSelectionTarget({
        sessionId: id,
        selectedIds: getSelectedIds(),
        clearSelection: () => onClearSelection?.(),
      }),
  });
  const linkedRequest = getLinkedRequest({ pullRequest, mergeRequest });
  const isGitlab = mergeRequest != null && pullRequest == null;
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
    nav.openPullRequest(session);
  };

  const selectFromEvent = (event: CardSelectionEvent): boolean => {
    if (onModifierClick && (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey)) {
      onModifierClick(id, event);
      return true;
    }
    return false;
  };

  const tone = sessionTone({ stage, attention, isRunning });

  return (
    <article
      data-archived={archived || undefined}
      data-select-id={id}
      onContextMenu={menu.onContextMenu}
      onClick={(event) => {
        if (selectFromEvent(event)) {
          return;
        }
        nav.selectCard(session);
      }}
      className={cn(
        'group/session-card group/select-row grid h-28 shrink-0 cursor-pointer grid-cols-[minmax(0,1fr)_auto] grid-rows-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 p-3 text-left',
        onToggleSelect === undefined ? 'pl-5' : 'pl-7',
        sessionCardShell({ selected }),
      )}
    >
      <ToneBar
        tone={tone.tone}
        density="card"
        isBreathing={tone.isBreathing}
        {...(onToggleSelect === undefined ? {} : { className: RAIL_UNDER_CHECKBOX })}
      />
      {onToggleSelect !== undefined && (
        <SelectionCheckbox
          checked={selected === true}
          label={`Select ${inlineMarkdownText({ text: title })}`}
          onToggle={(event) => onToggleSelect(id, event)}
          className="absolute top-2.5 left-1"
        />
      )}
      <span className="flex min-w-0 flex-col justify-between">
        <span className="flex min-h-10 items-start gap-2">
          <PrRequestSlot
            linkedRequest={linkedRequest}
            isGitlab={isGitlab}
            prFetchState={prFetchState}
            onOpen={handlePrClick}
          />
          {rename.editing ? (
            <Input
              autoFocus
              value={rename.draft}
              maxLength={rename.maxLength}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => rename.setDraft(event.target.value)}
              onBlur={() => void rename.commit()}
              onKeyDown={rename.onKeyDown}
              aria-label="Session title"
              className="min-w-0 flex-1"
            />
          ) : (
            <button
              type="button"
              title={inlineMarkdownText({ text: title })}
              aria-pressed={selected === true}
              aria-keyshortcuts="Alt+Enter Shift+F10"
              onKeyDown={(event) => {
                menu.onKeyDown(event);
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
              className="min-w-0 flex-1 cursor-pointer rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <InlineMarkdown text={title} className="line-clamp-2 min-h-10 text-row" />
            </button>
          )}
          <ChatOriginGlyph sessionId={session.id} />
        </span>

        {progress !== null ? (
          <SessionProgress progress={progress} tone={summary.tone} />
        ) : reason !== '' && summary.addsFact ? (
          <span className="truncate text-meta text-muted-foreground">{reason}</span>
        ) : null}
      </span>

      <span className="col-start-2 row-start-1 flex items-center gap-1 self-start">
        <CardActionSlot label="Session quick actions">
          {!archived && visibleAction !== undefined && (
            <CardAction
              key={visibleAction.key}
              icon={visibleAction.icon}
              tone={visibleAction.tone}
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
          <ObjectOverflowMenu
            target={{ kind: 'session', sessionId: id }}
            label="Session actions"
            anchorKey={anchorKey}
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
          {isPinned && !archived ? (
            <span role="img" aria-label="Pinned" className="inline-flex shrink-0">
              <Pin size={ICON_SIZE.row} aria-hidden className="text-faint-foreground" />
            </span>
          ) : null}
          {agentCount > 0 && (
            <Tooltip content={agentCountLabel} side="top">
              <span
                aria-label={agentCountLabel}
                className="inline-flex shrink-0 items-center gap-1 text-meta text-faint-foreground"
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
                navigate({ to: branchPlace({ sessionId: id, tab: 'comments' }) });
              }}
              icon={<MessageSquareDiff size={10} aria-hidden />}
              label={<span className="tabular-nums">{reviewDraftCount}</span>}
              trailing={<span>draft {reviewDraftCount === 1 ? 'comment' : 'comments'}</span>}
              className="shrink-0"
            />
          )}
          {isAutoMode && (
            <Tooltip content={NAMES.runOnItsOwn} side="top">
              <span className="inline-flex shrink-0">
                <Chip
                  tone={CONCEPT_TONE.autorun}
                  size="xs"
                  bordered={false}
                  ariaLabel={NAMES.runOnItsOwn}
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
        <span className="ml-auto grid shrink-0 items-center justify-items-end">
          {sessionCost > 0 && (
            <CostBadge
              value={sessionCost}
              title={`Session spend: ${formatUsd(sessionCost)} (excludes summarizer)`}
              className="invisible col-start-1 row-start-1 shrink-0 text-meta text-faint-foreground group-hover/session-card:visible group-focus-within/session-card:visible"
            />
          )}
          {age && (
            <span className="col-start-1 row-start-1 shrink-0 text-meta text-faint-foreground group-hover/session-card:invisible group-focus-within/session-card:invisible">
              {age}
            </span>
          )}
        </span>
      </span>
    </article>
  );
});
