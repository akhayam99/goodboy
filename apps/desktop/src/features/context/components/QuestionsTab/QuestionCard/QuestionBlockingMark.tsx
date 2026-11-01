import { StatusDot } from '@goodboy/ui';

export const QuestionBlockingMark = () => (
  <span
    data-question-blocking=""
    className="inline-flex shrink-0 items-baseline gap-1 text-meta text-muted-foreground"
  >
    <StatusDot tone="warning" size="sm" className="self-center" />
    <span data-question-blocking-label="">Blocking</span>
  </span>
);
