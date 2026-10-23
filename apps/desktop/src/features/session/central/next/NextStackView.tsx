import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SectionHeader } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { NextGroupChoice } from '../../../../store/slices/next-view/state';
import { useElementWidth } from '../../../../shared/hooks/useElementWidth';
import type { ActionCardModel } from './actionCardsOf';
import { NextGroup } from './NextGroup';
import type { RebaseStopRowFor } from '../../../history/useRebaseStopRows';
import { nextGroupsOf, type NextGroupModel } from './nextGroupsOf';
import { nextRowCopyOf, type NextBranchName } from './nextRowCopyOf';
import { nextSeenKeyOf } from './nextSeenKeyOf';
import type { ActionCardActions } from './useActionCardActions';

const NARROW_COLUMN_PX = 560;

const NO_CHOICE: NextGroupChoice = {};

type NextCardParams = {
  readonly card: ActionCardModel;
};

type Props = {
  readonly sessionId: SessionId;
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly actionsFor: ActionCardActions['actionsFor'];
  readonly openFor?: ActionCardActions['openFor'];
  readonly chipFor?: (params: NextCardParams) => ReactNode;
  readonly nameFor?: (params: NextCardParams) => string | null;
  readonly branchFor?: (params: NextCardParams) => NextBranchName | null;
  readonly stopRowFor?: RebaseStopRowFor;
};

type GroupParams = {
  readonly group: NextGroupModel;
};

type HintParams = GroupParams & {
  readonly nameFor: Props['nameFor'];
};

const hintOf = ({ group, nameFor }: HintParams): string =>
  Array.from(new Set(group.rows.map((card) => nameFor?.({ card }) ?? card.title))).join(', ');

export const NextStackView = ({
  sessionId,
  cards,
  actionsFor,
  openFor,
  chipFor,
  nameFor,
  branchFor,
  stopRowFor,
}: Props) => {
  const { ref: observe, width: observedWidth } = useElementWidth();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const choice = useAppStore((state) => state.nextGroupChoice[sessionId]) ?? NO_CHOICE;
  const seen = useAppStore((state) => state.nextSeenSubjects[sessionId] ?? EMPTY_ARRAY);
  const chooseNextGroup = useAppStore((state) => state.chooseNextGroup);
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
      nextGroupsOf({ cards, seen }).map((group) => ({
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
    [branchFor, cards, seen, stopRowFor],
  );
  useEffect(() => {
    noteNextSubjects({
      sessionId,
      keys: groups.flatMap((group) =>
        group.rows.map((card) => nextSeenKeyOf({ group: group.id, card })),
      ),
    });
  }, [groups, noteNextSubjects, sessionId]);
  const width = observedWidth ?? measuredWidth;
  const isNarrow = width !== null && width < NARROW_COLUMN_PX;
  if (groups.length === 0) {
    return null;
  }
  const firstId = groups[0]?.id;
  const isOpenOf = ({ group }: GroupParams): boolean => choice[group.id] ?? group.id === firstId;
  const leadId = groups.find((group) => isOpenOf({ group }))?.id ?? null;
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
  return (
    <section
      ref={ref}
      aria-label="Next steps"
      data-next-stack=""
      className="flex min-w-0 flex-col gap-2"
    >
      <SectionHeader
        label="Next"
        headingLevel={2}
        meta={<span className="text-label text-faint-foreground">{total}</span>}
      />
      <div className="flex min-w-0 flex-col gap-1">
        {groups.map((group) => {
          const isOpen = isOpenOf({ group });
          return (
            <NextGroup
              key={group.id}
              group={group}
              isOpen={isOpen}
              isLead={group.id === leadId}
              isNarrow={isNarrow}
              hint={hintOf({ group, nameFor })}
              onToggle={() => chooseNextGroup({ sessionId, groupId: group.id, isOpen: !isOpen })}
              actionsFor={actionsFor}
              openFor={openFor}
              chipFor={chipFor}
              sessionId={sessionId}
              stopRowFor={stopRowFor}
            />
          );
        })}
      </div>
    </section>
  );
};
