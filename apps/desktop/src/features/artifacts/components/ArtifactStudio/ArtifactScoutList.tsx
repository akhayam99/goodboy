import { cn } from '@goodboy/ui';
import type { ArtifactScoutRow, ArtifactScoutState } from '../../artifactScoutRoster';

type Props = {
  readonly rows: ReadonlyArray<ArtifactScoutRow>;
  readonly emptyLine: string;
};

const DOT_CLASS: Record<ArtifactScoutState, string> = {
  planned: 'bg-muted-foreground/40',
  queued: 'bg-muted-foreground/40',
  running: 'bg-info motion-safe:animate-pulse',
  done: 'bg-success',
  skipped: 'bg-muted-foreground/40',
  failed: 'bg-danger',
};

const STATE_WORD: Record<ArtifactScoutState, string> = {
  planned: 'planned',
  queued: 'queued',
  running: 'running',
  done: 'done',
  skipped: 'skipped',
  failed: 'failed',
};

const stateLine = ({ row }: Readonly<{ row: ArtifactScoutRow }>): string => {
  const parts = [STATE_WORD[row.state]];
  if (row.detail !== null) {
    parts.push(row.detail);
  }
  if (row.claims !== null) {
    parts.push(row.claims);
  }
  return parts.join(' · ');
};

const rootLeaf = ({ root }: Readonly<{ root: string }>): string =>
  root
    .split('/')
    .filter((segment) => segment.length > 0)
    .pop() ?? root;

const whereLine = ({ row }: Readonly<{ row: ArtifactScoutRow }>): string | null => {
  if (row.root === null) {
    return null;
  }
  const leaf = rootLeaf({ root: row.root });
  return row.branch === null ? leaf : `${leaf} on ${row.branch}`;
};

export const ArtifactScoutList = ({ rows, emptyLine }: Props) => {
  if (rows.length === 0) {
    return (
      <p data-testid="artifact-scouts-empty" className="text-2xs text-muted-foreground">
        {emptyLine}
      </p>
    );
  }

  return (
    <ul data-testid="artifact-scouts" className="flex min-w-0 flex-col gap-1">
      {rows.map((row) => {
        const where = whereLine({ row });
        return (
          <li
            key={row.key}
            data-testid="artifact-scout-row"
            className="flex min-w-0 flex-col gap-0.5 text-2xs text-muted-foreground"
          >
            <span className="flex min-w-0 items-baseline gap-2">
              <span
                aria-hidden
                className={cn('mt-1 size-1.5 shrink-0 rounded-full', DOT_CLASS[row.state])}
              />
              <span className="shrink-0 font-medium text-foreground">{row.name}</span>
              {where === null ? null : (
                <span
                  className="min-w-0 shrink truncate font-mono"
                  title={row.root === null ? where : row.root}
                >
                  {where}
                </span>
              )}
              <span className="ml-auto shrink-0 tabular-nums">{stateLine({ row })}</span>
            </span>
            {row.reason === null ? null : (
              <span
                data-testid="artifact-scout-reason"
                className="min-w-0 truncate pl-3.5"
                title={row.reason}
              >
                {row.reason}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
};
