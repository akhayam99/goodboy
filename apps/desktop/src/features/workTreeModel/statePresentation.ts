import { Check, CheckCheck, Reply, SkipForward, type LucideIcon } from 'lucide-react';
import type { Tone } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import type { ReviewCommentState } from '../resolve/reviewCommentState';
import type { RowState, RowStateReason } from './rowState';
import { rowStateSentence, rowStateShortSentence, rowStateTone } from './rowStateCopy';

export type StatePresentation = {
  readonly word: string;
  readonly short: string;
  readonly tone: Tone;
  readonly icon: LucideIcon | null;
};

const REVIEW_ICON: Record<ReviewCommentState, LucideIcon | null> = {
  new: null,
  drafting: null,
  needs: null,
  ready: null,
  edited: null,
  outdated: null,
  failed: null,
  accepted: Check,
  replied: Reply,
  skipped: SkipForward,
  pushed: CONCEPT_ICONS.push,
  resolved: CheckCheck,
};

const REASON_ICON: Record<RowStateReason['kind'], LucideIcon | null> = {
  ready: null,
  question: null,
  stepAsking: null,
  openQuestions: null,
  budget: null,
  failed: null,
  blocked: null,
  noArtifact: null,
  needsApproval: null,
  stepFailed: null,
  stepBlocked: null,
  orchestratorFailed: null,
  stopped: null,
  agentStopped: null,
  stepStopped: null,
  deciding: null,
  briefing: null,
  chatTurn: null,
  closed: CONCEPT_ICONS.runCancelled,
  skipped: SkipForward,
  paused: null,
  planReady: null,
  chained: null,
  awaitingFirstMessage: null,
  discarded: null,
  job: null,
  review: null,
};

const iconOf = ({ reason }: { readonly reason: RowStateReason }): LucideIcon | null =>
  reason.kind === 'review' ? REVIEW_ICON[reason.state] : REASON_ICON[reason.kind];

export const statePresentationOf = ({
  state,
}: {
  readonly state: RowState;
}): StatePresentation | null => {
  const word = rowStateSentence({ state });
  if (word == null || state.reason == null) {
    return null;
  }
  return {
    word,
    short: rowStateShortSentence({ state }) ?? word,
    tone: rowStateTone({ state }),
    icon: iconOf({ reason: state.reason }),
  };
};
