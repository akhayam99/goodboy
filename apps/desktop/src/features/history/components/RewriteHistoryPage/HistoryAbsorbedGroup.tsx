import { useState } from 'react';
import { Collapsible } from '@goodboy/ui';
import { subjectWithoutType, type AppliedTypeGroup } from '../../groupAppliedEdits';

type Props = {
  readonly group: AppliedTypeGroup;
};

export const HistoryAbsorbedGroup = ({ group }: Props) => {
  const [isOpen, setOpen] = useState(false);
  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setOpen}
      trigger={
        <span className="flex items-baseline gap-2 text-label">
          <span className="text-foreground">{group.type}</span>
          <span className="text-secondary text-muted-foreground tabular-nums">
            {group.items.length}
          </span>
        </span>
      }
    >
      <ul className="flex flex-col gap-0.5">
        {group.items.map((item) => (
          <li
            key={item.sha}
            title={item.title}
            className="flex min-w-0 items-baseline gap-2 text-label text-muted-foreground"
          >
            <span className="min-w-0 flex-1 truncate">
              {subjectWithoutType({ title: item.title })}
            </span>
            <span className="shrink-0 font-mono text-secondary text-faint-foreground tabular-nums">
              {item.sha.slice(0, 7)}
            </span>
          </li>
        ))}
      </ul>
    </Collapsible>
  );
};
