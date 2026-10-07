import { Eye, Hammer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Tone } from '@goodboy/ui';
import type { SessionAttentionReason, SessionStage, SessionStageInfo } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import { NAMES } from '../../shared/names';
import { PULL_REQUEST_PRESENTATION } from '../../shared/pullRequestPresentation';
import type { StatePresentation } from '../../shared/utils/statePresentation';

export type AttentionMark = '!' | '?' | 'approval' | 'approved' | 'none';

type AttentionEntry = {
  readonly icon: keyof typeof CONCEPT_ICONS;
  readonly tone: Tone;
  readonly mark: AttentionMark;
  readonly words: string;
  readonly reason: string;
};

type EntryParams = Pick<AttentionEntry, 'icon' | 'tone' | 'mark' | 'words'>;

const entryOf = ({ icon, tone, mark, words }: EntryParams): AttentionEntry => ({
  icon,
  tone,
  mark,
  words,
  reason: words,
});

export const ATTENTION_REASON_META: Record<SessionAttentionReason, AttentionEntry> = {
  'agent-error': entryOf({
    icon: 'errors',
    tone: 'danger',
    mark: '!',
    words: 'An agent stopped on an error',
  }),
  'ci-failed': entryOf({ icon: 'checks', tone: 'danger', mark: '!', words: 'Checks failing' }),
  'open-question': entryOf({
    icon: 'questions',
    tone: 'warning',
    mark: '?',
    words: '1 question for you',
  }),
  'fix-needs-you': entryOf({
    icon: 'review',
    tone: 'warning',
    mark: '?',
    words: '1 comment needs you',
  }),
  'needs-approval': entryOf({
    icon: 'approval',
    tone: 'warning',
    mark: 'approval',
    words: 'Waiting for your approval',
  }),
  'plan-approval': entryOf({
    icon: 'plan',
    tone: 'warning',
    mark: 'approval',
    words: 'The plan waits for your approval',
  }),
  'changes-requested': entryOf({
    icon: 'review',
    tone: 'warning',
    mark: '!',
    words: 'Changes requested',
  }),
  'fix-couldnt-fix': entryOf({
    icon: 'review',
    tone: 'warning',
    mark: '!',
    words: "1 comment it couldn't fix",
  }),
  'pr-approved': entryOf({
    icon: 'pr',
    tone: 'success',
    mark: 'approved',
    words: 'Approved, ready to merge',
  }),
  'unread-reply': entryOf({ icon: 'agents', tone: 'info', mark: 'none', words: 'New reply' }),
};

type AttentionCounts = Pick<
  SessionStageInfo,
  'openQuestionCount' | 'fixNeedsYouCount' | 'fixCouldntFixCount'
>;

type WordsParams = {
  readonly reason: SessionAttentionReason;
  readonly counts?: AttentionCounts;
  readonly planVersion?: number | null;
};

const countOf = ({ count }: { readonly count: number | undefined }): number =>
  Math.max(count ?? 1, 1);

export const attentionWordsOf = ({
  reason,
  counts = {},
  planVersion = null,
}: WordsParams): string => {
  if (reason === 'open-question') {
    const count = countOf({ count: counts.openQuestionCount });
    return count === 1 ? '1 question for you' : `${count} questions for you`;
  }
  if (reason === 'fix-needs-you') {
    const count = countOf({ count: counts.fixNeedsYouCount });
    return count === 1 ? '1 comment needs you' : `${count} comments need you`;
  }
  if (reason === 'fix-couldnt-fix') {
    const count = countOf({ count: counts.fixCouldntFixCount });
    return count === 1 ? "1 comment it couldn't fix" : `${count} comments it couldn't fix`;
  }
  if (reason === 'plan-approval' && planVersion !== null) {
    return `Plan v${planVersion} waits for your approval`;
  }
  return ATTENTION_REASON_META[reason].words;
};

export type AttentionLine = {
  readonly reason: SessionAttentionReason;
  readonly tone: Tone;
  readonly words: string;
};

type LinesParams = {
  readonly info: SessionStageInfo;
};

export const otherAttentionLinesOf = ({ info }: LinesParams): ReadonlyArray<AttentionLine> =>
  (info.otherReasons ?? []).map((reason) => ({
    reason,
    tone: ATTENTION_REASON_META[reason].tone,
    words: attentionWordsOf({ reason, counts: info }),
  }));

type SessionStageEntry = {
  readonly label: string;
  readonly reason: string;
};

export const SESSION_STAGE_META: Record<SessionStage, SessionStageEntry> = {
  attention: {
    label: NAMES.needsYou.toLowerCase(),
    reason: 'Blocked until you act',
  },
  running: {
    label: NAMES.running.toLowerCase(),
    reason: 'An agent is working right now',
  },
  review: {
    label: NAMES.inReview.toLowerCase(),
    reason: 'The work is out for review',
  },
  building: {
    label: NAMES.building.toLowerCase(),
    reason: 'Work in progress, nothing to review yet',
  },
  done: {
    label: NAMES.done.toLowerCase(),
    reason: 'Nothing left to do here',
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
