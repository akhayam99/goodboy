import { memo, useId } from 'react';
import { cn, isKeyboardFocus, Tooltip, InlineMarkdown, ToneBar, TruncatedText } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { FOCUS_RING } from '@goodboy/ui';
import { CardFactsLine } from './CardFactsLine';
import { CardQuickActions } from './CardQuickActions';
import { useCardHover, type CardHover } from './useCardHover';
import { sessionCardShell } from '../../../../session/components/sessionCardShell';
import { stageTrackOf } from '../../../../session/stageTrackOf';
import type { BoardNavigation } from '../useBoardNavigation';
import { useCardSignal } from './useCardSignal';
import { WaitingRunLine } from '../WaitingRunLine';
import { useDynamicActions } from './useDynamicActions';
import { useObjectMenuTrigger } from '../../../../actions/useObjectMenuTrigger';
import { useRenameRequest } from '../../../../../shared/hooks/useRenameRequest';
import { useSelectRequest } from '../../../../actions/useSelectRequest';
import { useSessionRowFacts } from '../../../hooks/useSessionRowFacts';
import { sessionObjectKey } from '../../../../actions/kinds/session';
import { sessionSelectionTarget } from '../../../../actions/sessionSelectionTarget';
import { useSessionTitleRename } from '../../../../session/hooks/useSessionTitleRename';
import { CardRenameField } from './CardRenameField';
import { CardSignal } from './CardSignal';
import { signalActionOf } from './signalActionOf';
import { cardContextOf } from '../cardContextOf';
import { cardFactsOf } from '../cardFactsOf';
import { useFleetPhrase } from '../../../hooks/useFleetPhrase';

type CardSelectionEvent = {
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
};

export type StageBoardCardDensity = 'card' | 'row';

type StageBoardCardProps = {
  readonly session: Session;
  readonly nav: BoardNavigation;
  readonly archived?: boolean;
  readonly selected?: boolean;
  readonly density?: StageBoardCardDensity;
  readonly getSelectedIds?: () => ReadonlyArray<SessionId>;
  readonly onClearSelection?: () => void;
  readonly onModifierClick?: (id: SessionId, event: CardSelectionEvent) => void;
  readonly onRestore?: (session: Session) => Promise<void>;
  readonly onHoverEnter?: (target: CardHover) => void;
  readonly onHoverLeave?: () => void;
};

const NO_SELECTION: ReadonlyArray<SessionId> = [];
const noSelectedIds = (): ReadonlyArray<SessionId> => NO_SELECTION;

const TITLE_CLASS: Record<StageBoardCardDensity, string> = {
  card: 'line-clamp-2 text-row text-foreground',
  row: 'line-clamp-1 text-ui text-foreground',
};

export const StageBoardCard = memo(function StageBoardCard({
  session,
  nav,
  archived,
  selected,
  density = 'card',
  getSelectedIds = noSelectedIds,
  onClearSelection,
  onModifierClick,
  onRestore,
  onHoverEnter,
  onHoverLeave,
}: StageBoardCardProps) {
  const id = session.id as SessionId;
  const stateWordId = useId();
  const isArchived = archived === true;
  const isRow = density === 'row';
  const { summary, node, rowTitle, keys, title, plainTitle } = useSessionRowFacts({
    session,
    isArchived,
  });
  const { stage, info } = summary;
  const { signal, waitingRun, attentionAction } = useCardSignal({ session, info, isArchived });
  const track = stageTrackOf({ stage, isArchived });
  const mounts = useAppStore((s) => s.sessionProjectMounts?.[id] ?? EMPTY_ARRAY);
  const context = cardContextOf({ mounts });
  const facts = cardFactsOf({
    reason: summary.reason,
    hasFact: summary.addsFact,
    age: summary.age,
    signal,
    isArchived,
  });
  const phrase = useFleetPhrase({ sessionId: id });
  const livePhrase = isArchived ? null : phrase;
  const dynamicActions = useDynamicActions(session, nav, stage);

  const [visibleAction = attentionAction ?? undefined] = waitingRun === null ? dynamicActions : [];
  const signalAction = signalActionOf({ signal, action: visibleAction, isArchived, waitingRun });
  const anchorKey = `board:${id}`;
  const rename = useSessionTitleRename({ sessionId: id, goal: session.goal, ...rowTitle });
  useRenameRequest({
    objectKey: sessionObjectKey({ sessionId: id }),
    anchorKeys: [anchorKey],
    onRename: rename.start,
  });
  useSelectRequest({
    objectKey: sessionObjectKey({ sessionId: id }),
    anchorKey,
    onSelect: () =>
      onModifierClick?.(id, { shiftKey: false, metaKey: false, ctrlKey: false, altKey: true }),
  });
  const menu = useObjectMenuTrigger({
    target: { kind: 'session', sessionId: id },
    anchorKey,
    viewing: { kind: 'selection', id },
    onBeforeOpen: () =>
      sessionSelectionTarget({
        sessionId: id,
        selectedIds: getSelectedIds(),
        clearSelection: () => onClearSelection?.(),
      }),
  });
  const handlePrClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    nav.openPullRequest(session);
  };

  const selectFromEvent = (event: CardSelectionEvent): boolean => {
    if (onModifierClick && (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey)) {
      onModifierClick(id, event);
      return true;
    }
    return false;
  };

  const { enterCard, leaveCard, resumeCard } = useCardHover({
    sessionId: id,
    onHoverEnter,
    onHoverLeave,
  });

  const titleNode = rename.editing ? (
    <CardRenameField rename={rename} keys={keys} />
  ) : (
    <Tooltip content={plainTitle}>
      <button
        type="button"
        aria-pressed={selected === true}
        aria-describedby={stateWordId}
        aria-keyshortcuts="Alt+Enter Shift+Enter Shift+F10"
        onFocus={(event) => {
          if (!isKeyboardFocus({ target: event.currentTarget })) {
            return;
          }
          enterCard({
            anchor: event.currentTarget.closest('article') ?? event.currentTarget,
          });
        }}
        onBlur={leaveCard}
        onKeyDown={(event) => {
          menu.onKeyDown(event);
          if (event.key !== 'Enter' && event.key !== ' ') {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          if (
            (event.altKey || (event.shiftKey && event.key === 'Enter')) &&
            selectFromEvent(event)
          ) {
            return;
          }
          nav.selectCard(session);
        }}
        className={cn('min-w-0 cursor-pointer self-start rounded-sm text-left', FOCUS_RING)}
      >
        <InlineMarkdown text={title} className={TITLE_CLASS[density]} />
      </button>
    </Tooltip>
  );

  const signalNode = (
    <span className="flex shrink-0">
      <CardSignal
        signal={signal}
        action={signalAction}
        onOpenRequest={handlePrClick}
        onGlyphEnter={leaveCard}
        onGlyphLeave={resumeCard}
      />
    </span>
  );

  const actionNode = (
    <CardQuickActions
      session={session}
      sessionId={id}
      isArchived={isArchived}
      action={visibleAction !== undefined && signalAction === null ? visibleAction : null}
      onRestore={onRestore}
      onPointerEnter={leaveCard}
      onPointerLeave={resumeCard}
    />
  );

  return (
    <article
      data-archived={archived || undefined}
      data-select-id={id}
      data-density={density}
      onContextMenu={menu.onContextMenu}
      onMouseEnter={({ currentTarget }) => enterCard({ anchor: currentTarget })}
      onMouseLeave={leaveCard}
      onClick={(event) => {
        if (selectFromEvent(event)) {
          return;
        }
        nav.selectCard(session);
      }}
      className={cn(
        'group/session-card flex shrink-0 cursor-pointer text-left select-none [content-visibility:auto]',
        isRow ? 'min-h-9 items-center gap-2 py-2 pr-2 pl-4' : 'flex-col gap-2 p-3 pl-5 shadow-sm',
        sessionCardShell({ selected }),
      )}
    >
      <ToneBar tone={track.tone} density={density} isBreathing={track.isBreathing} />
      <span id={stateWordId} className="sr-only">
        {node.label}
      </span>
      {isRow ? (
        <>
          <span className="flex min-w-0 flex-1">{titleNode}</span>
          {signalNode}
          {actionNode}
        </>
      ) : (
        <>
          <div className="flex min-w-0 flex-col gap-0.5">
            {context === '' ? null : (
              <TruncatedText data-slot="card-context" className="text-meta text-muted-foreground">
                {context}
              </TruncatedText>
            )}
            <div className="flex min-w-0 items-start gap-2">
              <span className="flex min-w-0 flex-1">{titleNode}</span>
              {actionNode}
            </div>
          </div>
          {waitingRun === null ? null : <WaitingRunLine run={waitingRun} />}
          {livePhrase === null ? null : (
            <span data-fleet-phrase="" className="min-w-0 truncate text-meta text-muted-foreground">
              {livePhrase}
            </span>
          )}
          <CardFactsLine facts={facts} signal={signalNode} />
        </>
      )}
    </article>
  );
});
