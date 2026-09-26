import { Check } from 'lucide-react';
import { cn, tintClasses, type Tone } from '@goodboy/ui';
import type { PullRequestStateKind, SessionAttentionReason, SessionStage } from '@goodboy/types';
import { ATTENTION_REASON_META, SESSION_STAGE_ICON } from '../../../session/session-stage';
import { PULL_REQUEST_PRESENTATION } from '../../../../shared/pullRequestPresentation';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly stage: SessionStage;
  readonly attention: SessionAttentionReason | null;
  readonly tone: Tone;
  readonly prState: PullRequestStateKind | null;
  readonly isSelected?: boolean;
};

type MarkParams = Pick<Props, 'attention'>;

const attentionMark = ({ attention }: MarkParams): string | null => {
  if (attention === null) {
    return null;
  }
  if (attention === 'open-question') {
    return '?';
  }
  return ATTENTION_REASON_META[attention].tone === 'danger' ? '!' : null;
};

export const SessionRowNode = ({ stage, attention, tone, prState, isSelected = false }: Props) => {
  const mark = stage === 'attention' ? attentionMark({ attention }) : null;
  const isRunning = stage === 'running';
  const isAttention = stage === 'attention';
  const pr = prState === null ? null : PULL_REQUEST_PRESENTATION[prState];
  const StageIcon = SESSION_STAGE_ICON[stage];

  return (
    <span
      aria-hidden
      data-testid="session-row-node"
      data-node={
        isSelected ? 'selected' : mark !== null ? 'attention' : pr !== null ? 'pr' : 'stage'
      }
      className={cn(
        'relative inline-flex size-5 shrink-0 items-center justify-center rounded-full',
        isAttention && !isSelected && tintClasses(tone).bgSoft,
        isSelected && 'bg-primary',
      )}
    >
      {isSelected ? (
        <Check size={11} strokeWidth={3} className="text-on-tone" />
      ) : (
        <>
          {isRunning || isAttention ? (
            <span
              data-testid="session-row-ring"
              className={cn(
                'absolute inset-0 rounded-full ring-1',
                tintClasses(tone).ringStrong,
                isRunning && 'motion-safe:animate-soft-pulse',
              )}
            />
          ) : null}
          {mark !== null ? (
            <span className={cn('text-2xs font-semibold leading-none', tintClasses(tone).icon)}>
              {mark}
            </span>
          ) : pr !== null ? (
            <pr.icon size={ICON_SIZE.row} className={pr.textClass} />
          ) : (
            <StageIcon size={ICON_SIZE.row} className={tintClasses(tone).icon} />
          )}
        </>
      )}
    </span>
  );
};
