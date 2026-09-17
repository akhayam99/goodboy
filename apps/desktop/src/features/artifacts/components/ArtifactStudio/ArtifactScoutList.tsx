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

const whereLine = ({ row }: Readonly<{ row: ArtifactScoutRow }>): string | null => {
  if (row.root === null) {
    return null;
  }
  return row.branch === null ? row.root : `${row.root} on ${row.branch}`;
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
            className="flex min-w-0 items-baseline gap-2 text-2xs text-muted-foreground"
          >
            <span
              aria-hidden
              className={cn('mt-1 size-1.5 shrink-0 rounded-full', DOT_CLASS[row.state])}
            />
            <span className="shrink-0 font-medium text-foreground">{row.name}</span>
            {where === null ? null : (
              <span className="min-w-0 shrink truncate font-mono" title={where}>
                {where}
              </span>
            )}
            {row.reason === null ? null : (
              <span className="min-w-0 flex-1 truncate" title={row.reason}>
                {row.reason}
              </span>
            )}
            <span className="ml-auto shrink-0 tabular-nums">{stateLine({ row })}</span>
          </li>
        );
      })}
    </ul>
  );
};
