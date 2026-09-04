import { Chip, Eyebrow, SelectableRow, StatusDot, cn } from '@goodboy/ui';
import type { ScriptSource } from '../../scripts';

export type ManifestRailEntry = {
  readonly key: string;
  readonly source: ScriptSource;
  readonly packageName: string;
  readonly relDir: string;
  readonly manager: string;
  readonly scriptCount: number;
  readonly matchCount: number;
  readonly isRunning: boolean;
};

type Props = {
  readonly entries: ReadonlyArray<ManifestRailEntry>;
  readonly selectedKey: string;
  readonly hasSearch: boolean;
  readonly onSelect: (key: string) => void;
};

type Bucket = {
  readonly label: string | null;
  readonly entries: ReadonlyArray<ManifestRailEntry>;
};

const ROOT_LABEL = 'root';

const bucketLabel = ({ relDir }: { readonly relDir: string }): string => {
  const [head] = relDir.split(/[\\/]/).filter((part) => part !== '');
  return head ?? ROOT_LABEL;
};

const bucketEntries = ({
  entries,
}: {
  readonly entries: ReadonlyArray<ManifestRailEntry>;
}): ReadonlyArray<Bucket> => {
  const buckets = new Map<string, Array<ManifestRailEntry>>();
  for (const entry of entries) {
    const label = bucketLabel({ relDir: entry.relDir });
    const bucket = buckets.get(label);
    if (bucket === undefined) {
      buckets.set(label, [entry]);
    } else {
      bucket.push(entry);
    }
  }
  const labeled = [...buckets.keys()].filter((label) => label !== ROOT_LABEL);
  if (labeled.length < 2) {
    return [{ label: null, entries }];
  }
  return [...buckets.entries()].map(([label, bucket]) => ({
    label: label === ROOT_LABEL ? null : label,
    entries: bucket,
  }));
};

export const ManifestRail = ({ entries, selectedKey, hasSearch, onSelect }: Props) => (
  <nav
    aria-label="Manifest packages"
    className="sticky top-0 flex w-48 shrink-0 flex-col gap-2 self-start"
  >
    {bucketEntries({ entries }).map((bucket) => (
      <div key={bucket.label ?? ROOT_LABEL} className="flex flex-col gap-1">
        {bucket.label == null ? null : <Eyebrow label={bucket.label} />}
        {bucket.entries.map((entry) => {
          const selected = entry.key === selectedKey;
          const showMatches = hasSearch && !selected;
          return (
            <SelectableRow
              key={entry.key}
              selected={selected}
              ariaCurrent={selected}
              onClick={() => onSelect(entry.key)}
              className="flex-col items-stretch gap-0.5 px-2 py-1.5"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {entry.packageName}
                </span>
                {entry.isRunning ? (
                  <StatusDot
                    tone="info"
                    pulsing
                    size="sm"
                    ariaLabel={`Running script in ${entry.packageName}`}
                  />
                ) : null}
                <Chip
                  tone="neutral"
                  label={String(showMatches ? entry.matchCount : entry.scriptCount)}
                  size="3xs"
                  className={cn(showMatches && entry.matchCount === 0 && 'opacity-40')}
                />
              </span>
              <span className="flex min-w-0 items-center gap-1.5 text-3xs text-muted-foreground/70">
                <span className="truncate font-mono">
                  {entry.relDir === '' ? entry.manager : entry.relDir}
                </span>
                {showMatches ? (
                  <span className="ml-auto shrink-0 tabular-nums">
                    {entry.matchCount === 1 ? '1 match' : `${entry.matchCount} matches`}
                  </span>
                ) : null}
              </span>
            </SelectableRow>
          );
        })}
      </div>
    ))}
  </nav>
);
