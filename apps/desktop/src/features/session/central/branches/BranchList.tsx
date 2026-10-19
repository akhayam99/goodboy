import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Eyebrow, ICON_SIZE, ROW_INTERACTIVE, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { BranchRow } from './BranchRow';
import { branchFoldOf, type BranchEntry } from './branchStoryOf';

type Props = {
  readonly sessionId: SessionId;
  readonly entries: ReadonlyArray<BranchEntry>;
};

export const BranchList = ({ sessionId, entries }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const fold = branchFoldOf({ entries });
  const rows = isOpen ? entries : fold.shown;
  return (
    <section aria-label="Branches" className="@container flex min-w-0 flex-col gap-1">
      {entries.length >= 2 ? (
        <div className="flex items-center gap-2 px-1">
          <Eyebrow label="Branches" muted />
          <span className="text-meta text-faint-foreground">{entries.length}</span>
        </div>
      ) : null}
      <ul className="flex list-none flex-col">
        {rows.map((entry) => (
          <li key={entry.fact.mountId}>
            <BranchRow sessionId={sessionId} entry={entry} />
          </li>
        ))}
      </ul>
      {fold.label === null ? null : (
        <button
          type="button"
          aria-expanded={isOpen}
          data-branch-fold=""
          onClick={() => setIsOpen((wasOpen) => !wasOpen)}
          className={cn(
            'flex h-9 w-full min-w-0 items-center gap-2 rounded-md px-1 text-left text-label text-muted-foreground',
            ROW_INTERACTIVE,
          )}
        >
          <ChevronDown
            size={ICON_SIZE.row}
            aria-hidden
            className={cn('shrink-0', isOpen ? 'rotate-180' : null)}
          />
          <span className="truncate">{isOpen ? 'Show fewer branches' : fold.label}</span>
        </button>
      )}
    </section>
  );
};
