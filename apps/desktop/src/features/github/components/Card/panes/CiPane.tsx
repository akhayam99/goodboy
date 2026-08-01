import type { PrCheckRun, PullRequestState } from '@goodboy/types';
import { EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { formatDuration } from '../lib';
import { CheckConclusionIcon } from '../parts/CheckConclusionIcon';

type Props = {
  readonly checks: ReadonlyArray<PrCheckRun>;
  readonly pr: PullRequestState;
  readonly onOpenUrl: (url: string) => void;
};

export const CiPane = ({ checks, pr, onOpenUrl }: Props) => {
  if (checks.length === 0) {
    return (
      <EmptyState
        icon={CONCEPT_ICONS.checks}
        title="No CI runs yet"
        className="items-start px-0 py-0 text-left"
        action={
          <button
            type="button"
            onClick={() => onOpenUrl(pr.url)}
            className="text-2xs text-muted-foreground hover:text-foreground"
          >
            View on GitHub
          </button>
        }
      />
    );
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {checks.map((c, idx) => (
        <li key={`${c.name}-${idx}`}>
          <button
            type="button"
            onClick={() => (c.detailsUrl ? onOpenUrl(c.detailsUrl) : onOpenUrl(pr.url))}
            className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-[11px] text-left hover:bg-background"
            title={c.detailsUrl ?? c.name}
          >
            <CheckConclusionIcon conclusion={c.conclusion} />
            <span className="min-w-0 flex-1 truncate text-foreground">{c.name}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground/70">
              {formatDuration(c.durationMs)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
};
