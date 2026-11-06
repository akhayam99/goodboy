import { ChevronRight } from 'lucide-react';
import { cn, ICON_SIZE, TruncatedText } from '@goodboy/ui';
import type { AgentId } from '@goodboy/types';
import type { ArtifactScoutRow, ArtifactScoutState } from '../../artifactScoutRoster';

type OpenParams = Readonly<{ agentId: AgentId }>;

type Props = {
  readonly rows: ReadonlyArray<ArtifactScoutRow>;
  readonly emptyLine: string;
  readonly onOpen?: (params: OpenParams) => void;
};

const DOT_CLASS: Record<ArtifactScoutState, string> = {
  planned: 'bg-idle',
  queued: 'bg-idle',
  running: 'bg-info motion-safe:animate-soft-pulse',
  done: 'bg-success',
  skipped: 'border border-idle',
  failed: 'bg-danger',
};

const STATE_WORD: Record<ArtifactScoutState, string> = {
  planned: 'Planned',
  queued: 'Queued',
  running: 'Running',
  done: 'Done',
  skipped: 'Skipped',
  failed: 'Failed',
};

type SentenceParams = {
  readonly text: string;
};

const sentenceCase = ({ text }: SentenceParams): string =>
  text.length === 0 ? text : `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

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

const LINE_CLASS = 'flex min-w-0 items-baseline gap-2';

export const ArtifactScoutList = ({ rows, emptyLine, onOpen }: Props) => {
  if (rows.length === 0) {
    return (
      <p data-testid="artifact-scouts-empty" className="text-meta text-muted-foreground">
        {sentenceCase({ text: emptyLine })}
      </p>
    );
  }

  return (
    <ul data-testid="artifact-scouts" className="flex min-w-0 flex-col gap-1">
      {rows.map((row) => {
        const where = whereLine({ row });
        const agentId = row.agentId;
        const summary = (
          <>
            <span
              aria-hidden
              className={cn('mt-1 size-1.5 shrink-0 rounded-full', DOT_CLASS[row.state])}
            />
            <span className="shrink-0 font-medium text-foreground">
              {sentenceCase({ text: row.name })}
            </span>
            {where === null ? null : (
              <TruncatedText
                tooltip={row.root === null ? where : row.root}
                className="min-w-0 shrink truncate font-mono"
              >
                {where}
              </TruncatedText>
            )}
            <span className="ml-auto shrink-0 tabular-nums">{stateLine({ row })}</span>
          </>
        );
        return (
          <li
            key={row.key}
            data-testid="artifact-scout-row"
            className="flex min-w-0 flex-col gap-0.5 text-meta text-muted-foreground"
          >
            {onOpen === undefined || agentId === null ? (
              <span className={LINE_CLASS}>{summary}</span>
            ) : (
              <button
                type="button"
                aria-label={`Open ${sentenceCase({ text: row.name })}`}
                className={cn(LINE_CLASS, 'rounded-sm text-left hover:text-foreground')}
                onClick={() => onOpen({ agentId })}
              >
                {summary}
                <ChevronRight size={ICON_SIZE.row} aria-hidden className="shrink-0 self-center" />
              </button>
            )}
            {row.reason === null ? null : (
              <TruncatedText data-testid="artifact-scout-reason" className="min-w-0 truncate pl-4">
                {sentenceCase({ text: row.reason })}
              </TruncatedText>
            )}
          </li>
        );
      })}
    </ul>
  );
};
