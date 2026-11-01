import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SectionHeader } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useElementWidth } from '../../../../shared/hooks/useElementWidth';
import { OVERVIEW_CARD_OF_GROUP, type NextOverviewCardId } from '../cards/overviewCardOfGroup';
import type { ActionCardModel } from './actionCardsOf';
import { NextGroup } from './NextGroup';
import type { RebaseStopRowFor } from '../../../history/useRebaseStopRows';
import { nextGroupsOf } from './nextGroupsOf';
import { nextRowCopyOf, type NextBranchName } from './nextRowCopyOf';
import { nextSeenKeyOf } from './nextSeenKeyOf';
import type { ActionCardActions } from './useActionCardActions';

const NARROW_COLUMN_PX = 560;

type NextCardParams = {
  readonly card: ActionCardModel;
};

type Props = {
  readonly sessionId: SessionId;
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly actionsFor: ActionCardActions['actionsFor'];
  readonly openFor?: ActionCardActions['openFor'];
  readonly chipFor?: (params: NextCardParams) => ReactNode;
  readonly branchFor?: (params: NextCardParams) => NextBranchName | null;
  readonly stopRowFor?: RebaseStopRowFor;
  readonly overviewCard?: NextOverviewCardId | null;
  readonly hasHeader?: boolean;
  readonly canLead?: boolean;
};

export const NextStackView = ({
  sessionId,
  cards,
  actionsFor,
  openFor,
  chipFor,
  branchFor,
  stopRowFor,
  overviewCard = null,
  hasHeader = true,
  canLead = true,
}: Props) => {
  const { ref: observe, width: observedWidth } = useElementWidth();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const seen = useAppStore((state) => state.nextSeenSubjects[sessionId] ?? EMPTY_ARRAY);
  const noteNextSubjects = useAppStore((state) => state.noteNextSubjects);
  const ref = useCallback(
    (node: HTMLElement | null) => {
      observe(node);
      const measured = node === null ? 0 : node.getBoundingClientRect().width;
      setMeasuredWidth(measured > 0 ? measured : null);
    },
    [observe],
  );
  const groups = useMemo(
    () =>
      nextGroupsOf({ cards, seen })
        .filter(
          (group) => overviewCard === null || OVERVIEW_CARD_OF_GROUP[group.id] === overviewCard,
        )
        .map((group) => ({
          ...group,
          rows: group.rows.map((row) =>
            nextRowCopyOf({
              row,
              group: group.id,
              branch: branchFor?.({ card: row }) ?? null,
              stopLine:
                row.kind === 'rebase'
                  ? (stopRowFor?.({ mountId: row.mountId })?.sentence ?? null)
                  : null,
            }),
          ),
        })),
    [branchFor, cards, overviewCard, seen, stopRowFor],
  );
  useEffect(() => {
    noteNextSubjects({
      sessionId,
      keys: groups.flatMap((group) =>
        group.rows.map((row) => nextSeenKeyOf({ group: group.id, card: row })),
      ),
    });
  }, [groups, noteNextSubjects, sessionId]);
  const width = observedWidth ?? measuredWidth;
  const isNarrow = width !== null && width < NARROW_COLUMN_PX;
  if (groups.length === 0) {
    return null;
  }
  const leadId = canLead ? (groups[0]?.id ?? null) : null;
  const hasLabels = groups.length > 1;
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
  return (
    <section
      ref={ref}
      aria-label={hasHeader ? 'Next steps' : undefined}
      data-next-stack=""
      className="flex min-w-0 flex-col gap-2"
    >
      {hasHeader ? (
        <SectionHeader
          label="Next"
          headingLevel={2}
          meta={<span className="text-meta text-faint-foreground">{total}</span>}
        />
      ) : null}
      <div className="flex min-w-0 flex-col gap-2">
        {groups.map((group) => (
          <NextGroup
            key={group.id}
            group={group}
            hasLabel={hasLabels}
            isLead={group.id === leadId}
            isNarrow={isNarrow}
            actionsFor={actionsFor}
            openFor={openFor}
            chipFor={chipFor}
            sessionId={sessionId}
            stopRowFor={stopRowFor}
          />
        ))}
      </div>
    </section>
  );
};
