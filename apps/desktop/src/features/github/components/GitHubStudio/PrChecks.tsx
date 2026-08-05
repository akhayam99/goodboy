import type { PrCheckConclusion, PrCheckRun, PullRequestState } from '@goodboy/types';
import { Button, EmptyState } from '@goodboy/ui';
import {
  AlertCircle,
  Check,
  CircleSlash,
  Clock,
  ExternalLink,
  HelpCircle,
  MinusCircle,
  XCircle,
} from 'lucide-react';
import { formatDuration } from '../../utils/format-duration';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly checks: ReadonlyArray<PrCheckRun>;
  readonly pr: PullRequestState;
  readonly onOpenUrl: (url: string) => void;
};

export const PrChecks = ({ checks, pr, onOpenUrl }: Props) => {
  if (checks.length === 0) {
    return (
      <EmptyState
        bordered
        icon={CONCEPT_ICONS.checks}
        tone={CONCEPT_TONE.checks}
        title="No CI runs yet"
        description="Checks for this pull request will appear here once they start."
        action={
          <Button variant="ghost" size="sm" onClick={() => onOpenUrl(pr.url)}>
            View checks on GitHub
            <ExternalLink size={12} aria-hidden />
          </Button>
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
            onClick={() => onOpenUrl(c.detailsUrl ?? pr.url)}
            title={c.detailsUrl ?? c.name}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
          >
            <ConclusionIcon conclusion={c.conclusion} />
            <span className="min-w-0 flex-1 truncate text-foreground">{c.name}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground/70">
              {formatDuration(c.durationMs)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
};

function ConclusionIcon({ conclusion }: { conclusion: PrCheckConclusion }) {
  const props = { size: 15, 'aria-hidden': true } as const;
  if (conclusion === 'success') {
    return <Check {...props} className="shrink-0 text-success" />;
  }
  if (conclusion === 'failure') {
    return <XCircle {...props} className="shrink-0 text-danger" />;
  }
  if (conclusion === 'pending') {
    return <Clock {...props} className="shrink-0 text-warning" />;
  }
  if (conclusion === 'cancelled' || conclusion === 'timed_out') {
    return <CircleSlash {...props} className="shrink-0 text-muted-foreground" />;
  }
  if (conclusion === 'skipped' || conclusion === 'neutral' || conclusion === 'stale') {
    return <MinusCircle {...props} className="shrink-0 text-muted-foreground" />;
  }
  if (conclusion === 'action_required') {
    return <AlertCircle {...props} className="shrink-0 text-warning" />;
  }
  return <HelpCircle {...props} className="shrink-0 text-muted-foreground" />;
}
