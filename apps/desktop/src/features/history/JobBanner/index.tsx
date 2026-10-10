import { StatusDot, cn, tintClasses, type Tone } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { RebaseJobTone } from '../rebaseJob';
import { useRebaseJob } from '../useRebaseJob';
import { JobBannerActions } from './JobBannerActions';
import { JobBannerLine } from './JobBannerLine';

type Props = {
  readonly sessionId: SessionId;
  readonly worktreePath: string | null;
};

const TONE_OF: Readonly<Record<RebaseJobTone, Tone>> = {
  info: 'info',
  ok: 'success',
  warn: 'warning',
  danger: 'danger',
};

export const JobBanner = ({ sessionId, worktreePath }: Props) => {
  const controls = useRebaseJob({ sessionId, worktreePath });
  if (controls === null) {
    return null;
  }
  const { job } = controls;
  const tone = TONE_OF[job.tone];
  const isAlert = job.isSettled && (job.tone === 'warn' || job.tone === 'danger');
  return (
    <section
      aria-label="Rebase job"
      role={isAlert ? 'alert' : 'region'}
      data-state={job.state}
      className="relative flex min-w-0 flex-col rounded-lg bg-subtle py-3 pl-6 pr-4"
    >
      <span
        aria-hidden
        className={cn('absolute bottom-3 left-2.5 top-3 w-0.5 rounded-full', tintClasses(tone).dot)}
      />
      <div className="flex min-h-7 min-w-0 items-center gap-2">
        {job.isRunning ? <StatusDot tone={tone} size="md" pulsing /> : null}
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-row text-foreground',
            job.isRunning && 'text-shimmer',
          )}
        >
          {job.title}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <JobBannerActions controls={controls} />
        </div>
      </div>
      <JobBannerLine job={job} />
    </section>
  );
};
