import { cn } from '@goodboy/ui';
import type { ExploreEntry } from '../../explore';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { useNow } from '../../../../shared/hooks/useNow';

type Props = {
  readonly entry: ExploreEntry;
  readonly shouldShowName?: boolean;
};

export const ExplorePathLine = ({ entry, shouldShowName = false }: Props) => {
  const now = useNow(30_000);
  const slash = entry.relPath.lastIndexOf('/');
  const folder = slash < 0 ? '' : entry.relPath.slice(0, slash + 1);
  const facts = joinFacts({
    facts: [
      entry.sizeBytes === null ? null : formatBytes({ bytes: entry.sizeBytes }),
      entry.modifiedAt === null ? null : formatAge({ from: entry.modifiedAt, now }),
    ],
  });
  if (folder === '' && facts === '' && !shouldShowName) {
    return null;
  }
  return (
    <p
      data-slot="explore-file-meta"
      className="flex min-w-0 items-baseline gap-2 px-4 pb-2 pt-3 text-meta text-muted-foreground"
    >
      {folder === '' && !shouldShowName ? null : (
        <span data-slot="explore-file-path" className="flex min-w-0 items-baseline font-mono">
          <span className={cn('min-w-0 truncate', shouldShowName && 'text-faint-foreground')}>
            {folder}
          </span>
          {shouldShowName ? <span className="shrink-0 text-foreground">{entry.name}</span> : null}
        </span>
      )}
      {facts === '' ? null : <span className="shrink-0 tabular-nums">{facts}</span>}
    </p>
  );
};
