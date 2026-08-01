import { AlertCircle, CheckCheck, CircleDashed, CircleSlash, type LucideIcon } from 'lucide-react';
import { Chip, type Tone } from '@goodboy/ui';
import type { PullRequestState } from '@goodboy/types';

type Decision = NonNullable<PullRequestState['reviewDecision']>;

type DecisionMeta = {
  readonly tone: Tone;
  readonly label: string;
  readonly icon: LucideIcon;
};

const DECISION_META: Record<Decision, DecisionMeta> = {
  approved: { tone: 'success', label: 'Approved', icon: CheckCheck },
  changes_requested: { tone: 'warning', label: 'Changes requested', icon: AlertCircle },
  review_required: { tone: 'neutral', label: 'Review required', icon: CircleDashed },
};

type Props = {
  readonly decision: PullRequestState['reviewDecision'];
};

export const ReviewDecisionChip = ({ decision }: Props) => {
  if (decision == null) {
    return (
      <Chip
        tone="neutral"
        size="sm"
        icon={<CircleSlash size={11} aria-hidden />}
        label="No review decision"
      />
    );
  }

  const meta = DECISION_META[decision];
  const Icon = meta.icon;

  return (
    <Chip tone={meta.tone} size="sm" icon={<Icon size={11} aria-hidden />} label={meta.label} />
  );
};
