import { StatusDot } from '@goodboy/ui';

export const QuestionBlockingMark = () => (
  <span className="inline-flex shrink-0 items-center gap-1 text-meta text-muted-foreground">
    <StatusDot tone="warning" size="sm" />
    Blocking
  </span>
);
