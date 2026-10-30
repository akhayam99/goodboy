import { cn, tintClasses } from '@goodboy/ui';
import type { HelperUrgency } from './helperUrgencyOf';

type Props = {
  readonly urgency: HelperUrgency;
};

export const HelperUrgencyWord = ({ urgency }: Props) => (
  <span
    data-spawned-urgency=""
    className={cn('shrink-0 text-meta', tintClasses(urgency.tone).text)}
  >
    {urgency.word}
  </span>
);
