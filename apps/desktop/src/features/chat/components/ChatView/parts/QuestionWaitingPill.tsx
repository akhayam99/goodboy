import { ArrowDown } from 'lucide-react';
import { StatusDot } from '@goodboy/ui';
import type { OpenQuestionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly count: number;
  readonly questionId: OpenQuestionId;
};

const waitingLabel = ({ count }: { readonly count: number }): string =>
  count === 1 ? '1 question waiting' : `${count} questions waiting`;

export const QuestionWaitingPill = ({ count, questionId }: Props) => {
  const jump = () => {
    const anchor = document.querySelector(`[data-oq-anchor="${questionId}"]`);
    anchor?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    const card = anchor?.querySelector<HTMLElement>('[data-question-card]');
    card?.focus({ preventScroll: true });
  };

  return (
    <button
      type="button"
      onClick={jump}
      className="pointer-events-auto absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border-soft bg-floating px-3 py-1 text-label text-foreground shadow-lg motion-safe:transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      <StatusDot tone="warning" size="sm" />
      <span>{waitingLabel({ count })}</span>
      <ArrowDown size={ICON_SIZE.row} aria-hidden className="text-muted-foreground" />
    </button>
  );
};
