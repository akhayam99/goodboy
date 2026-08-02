import type { Tone } from '@goodboy/ui';
import type { SessionAttentionReason, SessionStage } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';

type AttentionEntry = {
  readonly icon: keyof typeof CONCEPT_ICONS;
  readonly tone: Tone;
};

export const ATTENTION_REASON_META: Record<SessionAttentionReason, AttentionEntry> = {
  'agent-error': { icon: 'errors', tone: 'danger' },
  'open-question': { icon: 'questions', tone: 'warning' },
  'unread-reply': { icon: 'agents', tone: 'primary' },
  'ci-failed': { icon: 'checks', tone: 'danger' },
  'changes-requested': { icon: 'review', tone: 'danger' },
  'pr-approved': { icon: 'pr', tone: 'success' },
};

type SessionStageEntry = {
  readonly label: string;
  readonly dotClassName: string;
  readonly textClassName: string;
};

export const SESSION_STAGE_META: Record<SessionStage, SessionStageEntry> = {
  attention: {
    label: 'needs you',
    dotClassName: 'bg-warning',
    textClassName: 'text-warning',
  },
  running: {
    label: 'running',
    dotClassName: 'bg-info',
    textClassName: 'text-info',
  },
  review: {
    label: 'in review',
    dotClassName: 'bg-muted-foreground/70',
    textClassName: 'text-muted-foreground',
  },
  building: {
    label: 'building',
    dotClassName: 'bg-muted-foreground/40',
    textClassName: 'text-muted-foreground/70',
  },
  done: {
    label: 'done',
    dotClassName: 'bg-success',
    textClassName: 'text-success',
  },
};

export const STAGE_TONE: Record<SessionStage, Tone> = {
  attention: 'warning',
  running: 'info',
  review: 'neutral',
  building: 'neutral',
  done: 'success',
};
