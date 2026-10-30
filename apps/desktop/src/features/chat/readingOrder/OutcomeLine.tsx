import { StatusDot, type Tone } from '@goodboy/ui';
import { READING_BUDGETS } from './readingBudgets';

type Props = {
  text: string;
  tone: Tone;
};

export const OutcomeLine = ({ text, tone }: Props) => (
  <p data-testid="outcome-line" className="flex min-w-0 items-center gap-2 text-heading">
    <StatusDot tone={tone} size="sm" />
    <span className="min-w-0 truncate">{text.slice(0, READING_BUDGETS.outcomeMaxChars)}</span>
  </p>
);
