import type { PrCheckRun, PrDetail, PullRequestState } from '@goodboy/types';
import {
  Button,
  EmptyState,
  Eyebrow,
  FOCUS_RING,
  Skeleton,
  StatusDot,
  cn,
  type Tone,
} from '@goodboy/ui';
import { ExternalLink } from 'lucide-react';
import { formatDuration } from '../../../../../shared/utils/time/formatDuration';
import {
  CONCEPT_ICONS,
  CONCEPT_TONE,
  ICON_SIZE,
} from '../../../../../shared/components/conceptIcons';
import { CheckConclusionIcon } from './CheckConclusionIcon';
import { checksGroupsOf, checksRollup, checksWordOf, type ChecksWord } from '../../checksRollup';

type Props = {
  readonly checks: ReadonlyArray<PrCheckRun>;
  readonly fallbackUrl: string;
  readonly hostLabel: string;
  readonly isLoading?: boolean;
  readonly pr?: PullRequestState;
  readonly detail?: PrDetail | null;
  readonly onOpenUrl: (url: string) => void;
};

const WORD_TONE: Readonly<Record<ChecksWord, Tone>> = {
  unknown: 'neutral',
  none: 'neutral',
  pending: 'warning',
  failing: 'danger',
  passing: 'success',
};

const SKELETON_ROWS = [0, 1, 2] as const;

export const PrChecks = ({
  checks,
  fallbackUrl,
  hostLabel,
  isLoading = false,
  pr,
  detail = null,
  onOpenUrl,
}: Props) => {
  if (isLoading && checks.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p
          role="status"
          className="px-2 text-label text-muted-foreground"
          data-testid="checks-rollup"
        >
          Reading checks
        </p>
        <div className="flex flex-col gap-2 px-2">
          {SKELETON_ROWS.map((row) => (
            <Skeleton key={row} className="h-4 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (checks.length === 0) {
    return (
      <EmptyState
        bordered
        icon={CONCEPT_ICONS.checks}
        tone={CONCEPT_TONE.checks}
        title="No checks have reported on this pull request yet"
        action={
          <Button variant="ghost" size="sm" onClick={() => onOpenUrl(fallbackUrl)}>
            View on {hostLabel}
            <ExternalLink size={ICON_SIZE.row} aria-hidden />
          </Button>
        }
      />
    );
  }

  const word = pr === undefined ? null : checksWordOf({ pr, detail });

  return (
    <div className="flex flex-col gap-4">
      <p
        className="flex items-center gap-2 px-2 text-label text-muted-foreground"
        data-testid="checks-rollup"
      >
        {word === null ? null : <StatusDot tone={WORD_TONE[word]} size="sm" />}
        {checksRollup({ checks })}
      </p>
      {checksGroupsOf({ checks }).map((entry) => (
        <div key={entry.group} className="flex flex-col gap-1">
          <Eyebrow className="px-2" label={entry.label} />
          <ul aria-label={`${entry.label} checks`} className="flex flex-col gap-0.5">
            {entry.runs.map((check, index) => (
              <li key={`${check.name}-${index}`}>
                <button
                  type="button"
                  onClick={() => onOpenUrl(check.detailsUrl ?? fallbackUrl)}
                  title={check.detailsUrl ?? check.name}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-body transition-colors hover:bg-hover',
                    FOCUS_RING,
                  )}
                >
                  <CheckConclusionIcon conclusion={check.conclusion} />
                  <span className="min-w-0 flex-1 truncate text-foreground">{check.name}</span>
                  <span className="shrink-0 text-label tabular-nums text-faint-foreground">
                    {check.durationMs === null
                      ? ''
                      : formatDuration({ durationMs: check.durationMs })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};
