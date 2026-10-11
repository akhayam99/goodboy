import type { ExploreEntry } from '../../explore';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { useNow } from '../../../../shared/hooks/useNow';

type Props = {
  readonly entry: ExploreEntry;
};

export const ExplorePathLine = ({ entry }: Props) => {
  const now = useNow(30_000);
  const slash = entry.relPath.lastIndexOf('/');
  const folders = slash < 0 ? '' : entry.relPath.slice(0, slash + 1);
  const modifiedLabel =
    entry.modifiedAt == null ? 'unknown age' : formatAge({ from: entry.modifiedAt, now });
  return (
    <div className="flex min-w-0 items-baseline gap-2 px-4 pb-2 pt-3">
      <p className="flex min-w-0 text-code text-foreground">
        <span className="min-w-0 truncate">{folders}</span>
        <span className="shrink-0">{entry.name}</span>
      </p>
      <span className="shrink-0 text-meta text-faint-foreground">
        {formatBytes({ bytes: entry.sizeBytes })} · {modifiedLabel}
      </span>
    </div>
  );
};
