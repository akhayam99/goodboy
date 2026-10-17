import { StatusDot, cn, type Tone } from '@goodboy/ui';
import { useState } from 'react';
import type { SessionId } from '@goodboy/types';
import type { RebaseJobState, RebaseJobTone } from '../rebaseJob';
import { useJobBannerActions } from '../hooks/useJobBannerActions';
import { useRebaseJob } from '../useRebaseJob';
import { StartHint } from '../../../shared/components/StartHint';
import { START_HINT_COPY } from '../../../shared/components/startHintCopy';
import { START_HINT_SCOPES } from '../../../store/slices/startHints/startHintScopes';
import { JobBannerActions } from './JobBannerActions';
import { JobBannerLine } from './JobBannerLine';
import { JobBannerNote } from './JobBannerNote';
import { JobBannerReview } from './JobBannerReview';

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

const RAIL_ONLY: ReadonlySet<RebaseJobState> = new Set<RebaseJobState>([
  'checking',
  'replaying',
  'checking-result',
  'waiting',
  'moving',
  'updating-online',
]);

export const JobBanner = ({ sessionId, worktreePath }: Props) => {
  const controls = useRebaseJob({ sessionId, worktreePath });
  const actions = useJobBannerActions({
    sessionId,
    worktreePath,
    agentId: controls?.agentId ?? null,
  });
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  if (controls === null || RAIL_ONLY.has(controls.job.state)) {
    return null;
  }
  const { job } = controls;
  const isNoteShown = isNoteOpen && job.state === 'stuck';
  const tone = TONE_OF[job.tone];
  const isAlert = job.isSettled && (job.tone === 'warn' || job.tone === 'danger');
  return (
    <section
      aria-label="Rebase job"
      role={isAlert ? 'alert' : 'region'}
      data-state={job.state}
      className="flex min-w-0 flex-col gap-1"
    >
      <div className="flex min-h-7 min-w-0 items-center gap-2">
        {job.tone === 'ok' && !job.isRunning ? null : (
          <StatusDot tone={tone} size="sm" pulsing={job.isRunning} />
        )}
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-row text-foreground',
            job.isRunning && 'text-shimmer',
          )}
        >
          {job.title}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <JobBannerActions
            controls={controls}
            actions={actions}
            isNoteOpen={isNoteShown}
            onToggleNote={() => setIsNoteOpen((isOpen) => !isOpen)}
          />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <JobBannerLine job={job} />
        <JobBannerReview sessionId={sessionId} mountId={actions.mountId} />
        {job.state === 'push-failed' && actions.mountId !== null ? (
          <StartHint
            sessionId={sessionId}
            scope={START_HINT_SCOPES.pushFix({ mountId: actions.mountId })}
            label={START_HINT_COPY.implementerLabel}
            placeholder={START_HINT_COPY.pushFix}
          />
        ) : null}
      </div>
      {isNoteShown ? (
        <JobBannerNote
          isPending={actions.pendingKeys.has('retry-note')}
          onSubmit={({ note }) => {
            actions.retryWithNote({ note });
            setIsNoteOpen(false);
          }}
          onCollapse={() => setIsNoteOpen(false)}
        />
      ) : null}
    </section>
  );
};
