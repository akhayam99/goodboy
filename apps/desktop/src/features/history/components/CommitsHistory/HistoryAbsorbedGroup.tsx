import { useState } from 'react';
import { Collapsible, TruncatedText } from '@goodboy/ui';
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
          <span className="text-meta text-muted-foreground tabular-nums">{group.items.length}</span>
        </span>
      }
    >
      <ul className="flex flex-col gap-0.5">
        {group.items.map((item) => (
          <li
            key={item.sha}
            className="flex min-w-0 items-baseline gap-2 text-label text-muted-foreground"
          >
            <TruncatedText tooltip={item.title} className="min-w-0 flex-1">
              {subjectWithoutType({ title: item.title })}
            </TruncatedText>
            <span className="shrink-0 font-mono text-meta text-faint-foreground tabular-nums">
              {item.sha.slice(0, 7)}
            </span>
          </li>
        ))}
      </ul>
    </Collapsible>
  );
};
