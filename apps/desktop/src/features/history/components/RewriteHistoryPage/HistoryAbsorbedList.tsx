import { useState } from 'react';
import { Collapsible } from '@goodboy/ui';
import type { HistoryAbsorbed } from '../../../../store/slices/history/types';
import { groupAppliedEdits } from '../../groupAppliedEdits';
import { HistoryAbsorbedGroup } from './HistoryAbsorbedGroup';

type Props = {
  readonly absorbed: ReadonlyArray<HistoryAbsorbed>;
};

export const HistoryAbsorbedList = ({ absorbed }: Props) => {
  const [isOpen, setOpen] = useState(false);
  const groups = groupAppliedEdits({ absorbed });
  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setOpen}
      className="mt-2"
      trigger={
        <span className="flex min-w-0 items-baseline gap-2 text-label">
          <span className="shrink-0 text-foreground">
            Absorbed <span className="tabular-nums">{absorbed.length}</span>{' '}
            {absorbed.length === 1 ? 'commit' : 'commits'}
          </span>
          <span className="min-w-0 truncate text-meta text-muted-foreground">
            {groups.map((group) => `${group.type} ${group.items.length}`).join(' · ')}
          </span>
        </span>
      }
    >
      <div className="flex flex-col gap-0.5">
        {groups.map((group) => (
          <HistoryAbsorbedGroup key={group.type} group={group} />
        ))}
      </div>
    </Collapsible>
  );
};
