import type { ReactNode } from 'react';
import { Button, Chip, StatusDot, WorkNode, type Tone } from '@goodboy/ui';
import { FIX_RUN_CHIPS, fixRunTitle, type FixRun, type FixRunWord } from '../../fixRun';

type Props = {
  readonly run: FixRun;
  readonly filter: FixRunWord | null;
  readonly onFilter: (word: FixRunWord | null) => void;
  readonly onOpenTranscript: () => void;
  readonly onStop: () => void;
  readonly actions?: ReactNode;
};

const CHIP_TONE: Readonly<Record<FixRunWord, Tone>> = {
  ready: 'success',
  needs_you: 'warning',
  working: 'info',
  couldnt_fix: 'danger',
};

export const ResolveRunStatus = ({
  run,
  filter,
  onFilter,
  onOpenTranscript,
  onStop,
  actions = null,
}: Props) => {
  const title = fixRunTitle({ run });
  return (
    <section
      aria-label="Fix run"
      data-testid="resolve-run-status"
      className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-subtle px-4 py-2 ring-1 ring-border-soft"
    >
      <span className="flex shrink-0 items-center gap-2 text-label text-foreground">
        {run.isLive && <WorkNode state="running" label={title} mark={{ kind: 'dot' }} />}
        {title}
      </span>
      <ul aria-label="Filter by state" className="flex min-w-0 flex-wrap items-center gap-1">
        {FIX_RUN_CHIPS.map(({ word, phrase }) => {
          const count = run.tally[word];
          if (count === 0) {
            return null;
          }
          return (
            <li key={word} className="list-none">
              <Chip
                as="button"
                tone={filter === word ? CHIP_TONE[word] : 'neutral'}
                size="xs"
                bordered={false}
                emphasis={filter === word ? 'soft' : 'subtle'}
                ariaPressed={filter === word}
                icon={<StatusDot tone={CHIP_TONE[word]} size="sm" />}
                label={`${count} ${phrase}`}
                onClick={() => onFilter(filter === word ? null : word)}
              />
            </li>
          );
        })}
      </ul>
      <span className="ml-auto flex min-w-0 shrink-0 items-center gap-1">
        <span className="px-2 text-meta text-muted-foreground">{run.model}</span>
        {actions}
        <Button size="sm" variant="ghost" onClick={onOpenTranscript}>
          Open transcript
        </Button>
        {run.isLive && (
          <Button size="sm" variant="ghost" onClick={onStop}>
            Stop
          </Button>
        )}
      </span>
    </section>
  );
};
