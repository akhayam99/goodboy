import type { ReactNode } from 'react';
import { Button, Chip, StatusDot, WorkNode, type Tone } from '@goodboy/ui';
import type { LaneStatus } from '../../laneStatus';
import { FIX_RUN_CHIPS, fixRunTitle, type FixRun, type FixRunChipKey } from '../../fixRun';
import { StopRunButton } from './StopRunButton';

type Props = {
  readonly run: FixRun;
  readonly filter: FixRunChipKey | null;
  readonly onFilter: (key: FixRunChipKey | null) => void;
  readonly onOpenTranscript: () => void;
  readonly onStop: () => void;
  readonly lane?: LaneStatus | null;
  readonly actions?: ReactNode;
  readonly noun?: 'comment' | 'note';
};

const CHIP_TONE: Readonly<Record<FixRunChipKey, Tone>> = {
  needs_you: 'warning',
  working: 'info',
  ready_to_push: 'success',
  push_failed: 'danger',
  couldnt_fix: 'warning',
};

export const ResolveRunStatus = ({
  run,
  filter,
  onFilter,
  onOpenTranscript,
  onStop,
  lane = null,
  actions = null,
  noun = 'comment',
}: Props) => {
  const title = lane === null ? fixRunTitle({ run, noun }) : lane.line;
  const isLive = run.isLive || lane !== null;
  return (
    <section
      aria-label="Fix run"
      data-testid="resolve-run-status"
      className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-subtle px-4 py-2 ring-1 ring-border-soft"
    >
      <span className="flex min-w-0 max-w-full items-center gap-2 text-label text-foreground">
        {isLive && <WorkNode state="running" label={title} mark={{ kind: 'dot' }} />}
        <span className="min-w-0 truncate" title={title}>
          {title}
        </span>
      </span>
      <ul aria-label="Filter by state" className="flex min-w-0 flex-wrap items-center gap-1">
        {FIX_RUN_CHIPS.map(({ key, phrase, countOf }) => {
          const count = countOf(run.tally);
          if (count === 0) {
            return null;
          }
          return (
            <li key={key} className="list-none">
              <Chip
                as="button"
                tone={filter === key ? CHIP_TONE[key] : 'neutral'}
                size="xs"
                bordered={false}
                emphasis={filter === key ? 'soft' : 'subtle'}
                ariaPressed={filter === key}
                icon={<StatusDot tone={CHIP_TONE[key]} size="sm" />}
                label={`${count} ${phrase}`}
                onClick={() => onFilter(filter === key ? null : key)}
              />
            </li>
          );
        })}
      </ul>
      <span className="ml-auto flex min-w-0 shrink-0 items-center gap-1">
        {actions}
        <span className="px-2 text-meta text-muted-foreground">{run.model}</span>
        <Button size="xs" variant="ghost" onClick={onOpenTranscript}>
          Open transcript
        </Button>
        {isLive && <StopRunButton onStop={onStop} />}
      </span>
    </section>
  );
};
