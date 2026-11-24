import { useMemo, useRef, type KeyboardEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ChevronLeft, ChevronRight } from '@goodboy/ui/icons';
import {
  BOARD_LANE_GAP_REM,
  BOARD_LANE_FADE_PX,
  cn,
  Eyebrow,
  IconButton,
  PANE_RHYTHM,
  ScrollFade,
  Tooltip,
} from '@goodboy/ui';
import type { Session, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { NAMES } from '../../../../../shared/utils/names';
import { sessionTitle } from '../../../../../shared/utils/sessionTitle';
import { formatSpan } from '../../../../../shared/utils/time/formatSpan';
import { useNow } from '../../../../../shared/hooks/useNow';
import { useNeedsYou } from './useNeedsYou';
import type { NeedsYouCard as Card } from '../../../../board/needsYou/needsYouOf';
import { ATTENTION_REASON_META } from '../../../../session/session-stage';
import { openAttentionTarget } from '../../../../session/openAttentionTarget';
import { rootRemPx } from '../boardLanesOf';
import { NeedsYouCard } from '../NeedsYouCard';
import { projectLineOf } from '../projectLineOf';
import { useStripScroll } from './useStripScroll';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessions: ReadonlyArray<Session>;
  readonly laneRem: number;
};

type MetaParams = {
  readonly card: Card;
  readonly now: number;
};

type KeyParams = {
  readonly event: KeyboardEvent<HTMLElement>;
};

type OpenParams = {
  readonly card: Card;
};

const CARD = '[data-needs-you-card]';
const AGE_MS = 30_000;

const metaOf = ({ card, now }: MetaParams): string => {
  const age = formatSpan({ from: card.move.since, to: now });
  const questions = card.questionCount > 1 ? `${card.questionCount} questions` : '';
  return [age, questions].filter((part) => part !== '').join(' · ');
};

const moveCardFocus = ({ event }: KeyParams): void => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
    return;
  }
  const cards = [...event.currentTarget.querySelectorAll<HTMLElement>(CARD)];
  const index = cards.findIndex((card) => card === document.activeElement);
  const next = cards[index + (event.key === 'ArrowRight' ? 1 : -1)];
  if (index === -1 || next === undefined) {
    return;
  }
  event.preventDefault();
  next.focus();
};

export const NeedsYouStrip = ({ workspaceId, sessions, laneRem }: Props) => {
  const { cards } = useNeedsYou({ sessions });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const now = useNow(AGE_MS);
  const stepPx = useMemo(() => (laneRem + BOARD_LANE_GAP_REM) * rootRemPx(), [laneRem]);
  const strip = useStripScroll({ viewportRef, stepPx, count: cards.length });
  const titles = useMemo(
    () => new Map(sessions.map((session) => [session.id, sessionTitle({ session })])),
    [sessions],
  );
  const projects = useAppStore(
    useShallow((state) =>
      cards.map((card) =>
        projectLineOf({ mounts: state.sessionProjectMounts[card.sessionId] ?? EMPTY_ARRAY }),
      ),
    ),
  );

  if (cards.length === 0) {
    return null;
  }

  const open = ({ card }: OpenParams): void => {
    void openAttentionTarget({
      target: {
        workspaceId,
        sessionId: card.sessionId,
        reason: card.move.reason,
        agentId: null,
      },
    });
  };

  return (
    <section aria-label={NAMES.needsYou} className="flex shrink-0 flex-col gap-2">
      <div className="flex h-6 items-center justify-between gap-2">
        <Tooltip content="What waits on you, the oldest first" shortcut="session.nextNeedsYou">
          <span className="flex items-center gap-2">
            <Eyebrow label={NAMES.needsYou} />
            <span className="text-meta tabular-nums text-faint-foreground">{cards.length}</span>
          </span>
        </Tooltip>
        {strip.isOverflowing ? (
          <span className="flex items-center gap-1">
            <IconButton
              icon={ChevronLeft}
              label="Scroll left"
              size="xs"
              disabled={strip.isAtStart}
              onClick={() => strip.scroll({ direction: -1 })}
            />
            <IconButton
              icon={ChevronRight}
              label="Scroll right"
              size="xs"
              disabled={strip.isAtEnd}
              onClick={() => strip.scroll({ direction: 1 })}
            />
          </span>
        ) : null}
      </div>
      <ScrollFade
        orientation="horizontal"
        fadeSize={BOARD_LANE_FADE_PX}
        viewportRef={viewportRef}
        onViewportScroll={strip.measure}
      >
        <div
          role="list"
          onKeyDown={(event) => moveCardFocus({ event })}
          onFocus={(event) =>
            event.target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
          }
          className={cn('flex w-max flex-nowrap', PANE_RHYTHM.board.laneGap)}
        >
          {cards.map((card, index) => {
            const title = titles.get(card.sessionId) ?? '';
            return (
              <div
                key={card.sessionId}
                role="listitem"
                style={{ width: `${laneRem}rem` }}
                className="flex shrink-0"
              >
                <NeedsYouCard
                  sessionId={card.sessionId}
                  title={title}
                  project={projects[index] ?? ''}
                  reason={card.move.title}
                  meta={metaOf({ card, now })}
                  tone={ATTENTION_REASON_META[card.move.reason].tone}
                  onOpen={() => open({ card })}
                />
              </div>
            );
          })}
        </div>
      </ScrollFade>
    </section>
  );
};
