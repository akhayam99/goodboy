import { Eye, Hammer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Tone } from '@goodboy/ui';
import type { SessionAttentionReason, SessionStage, SessionStageInfo } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import { PULL_REQUEST_PRESENTATION } from '../../shared/pullRequestPresentation';
import type { StatePresentation } from '../../shared/utils/statePresentation';

type AttentionEntry = {
  readonly icon: keyof typeof CONCEPT_ICONS;
  readonly tone: Tone;
  readonly reason: string;
};

export const ATTENTION_REASON_META: Record<SessionAttentionReason, AttentionEntry> = {
  'agent-error': { icon: 'errors', tone: 'danger', reason: 'the agent stopped with an error' },
  'open-question': { icon: 'questions', tone: 'warning', reason: 'the agent asked you something' },
  'unread-reply': {
    icon: 'agents',
    tone: 'primary',
    reason: 'the agent replied and you have not read it',
  },
  'ci-failed': { icon: 'checks', tone: 'danger', reason: 'a check failed on the pull request' },
  'changes-requested': { icon: 'review', tone: 'danger', reason: 'a reviewer asked for changes' },
  'pr-approved': {
    icon: 'pr',
    tone: 'success',
    reason: 'the pull request is approved and ready to merge',
  },
};

type SessionStageEntry = {
  readonly label: string;
  readonly reason: string;
};

export const SESSION_STAGE_META: Record<SessionStage, SessionStageEntry> = {
  attention: {
    label: 'needs you',
    reason: 'blocked until you act',
  },
  running: {
    label: 'running',
    reason: 'an agent is working right now',
  },
  review: {
    label: 'in review',
    reason: 'the work is out for review',
  },
  building: {
    label: 'building',
    reason: 'work in progress, nothing to review yet',
  },
  done: {
    label: 'done',
    reason: 'nothing left to do here',
  },
};

export const SESSION_STAGE_ICON: Record<SessionStage, LucideIcon> = {
  attention: CONCEPT_ICONS.questions,
  running: CONCEPT_ICONS.sessions,
  review: Eye,
  building: Hammer,
  done: CONCEPT_ICONS.runDone,
};

export const STAGE_TONE: Record<SessionStage, Tone> = {
  attention: 'warning',
  running: 'info',
  review: 'success',
  building: 'neutral',
  done: 'merged',
};

type BucketParams = {
  readonly stage: SessionStage;
};

export const describeStageBucket = ({ stage }: BucketParams): StatePresentation => {
  const meta = SESSION_STAGE_META[stage];
  return {
    label: meta.label,
    reason: meta.reason,
    tone: STAGE_TONE[stage],
    icon: SESSION_STAGE_ICON[stage],
  };
};

export const describeSessionStage = ({
  stage,
  reason,
  attention,
  prState,
}: SessionStageInfo): StatePresentation => {
  const meta = SESSION_STAGE_META[stage];
  const given = reason === '' ? null : reason;

  if (attention !== null) {
    const attentionMeta = ATTENTION_REASON_META[attention];
    return {
      label: meta.label,
      reason: given ?? attentionMeta.reason,
      tone: attentionMeta.tone,
      icon: CONCEPT_ICONS[attentionMeta.icon],
    };
  }

  if (stage === 'done' && prState === 'closed') {
    const closed = PULL_REQUEST_PRESENTATION.closed;
    return {
      label: meta.label,
      reason: given ?? closed.reason,
      tone: 'neutral',
      icon: closed.icon,
    };
  }

  return {
    label: meta.label,
    reason: given ?? meta.reason,
    tone: STAGE_TONE[stage],
    icon: SESSION_STAGE_ICON[stage],
  };
};
