import { Pencil } from 'lucide-react';
import { SectionHeader, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatClockTime } from '../../../../shared/utils/formatClockTime';
import { LINE_FILL, SIGN_TEXT } from '../../../diff/lib/lineTone';
import { REVIEW_FLOW_LABEL, sourceChangeLine } from '../../reviewFlowCopy';
import type { ReviewSourceChange } from '../../sourceChangeOf';
import { wordDiff, type WordSegment } from '../../wordDiff';

type Props = {
  readonly change: ReviewSourceChange;
};

const Line = ({
  kind,
  segments,
}: {
  readonly kind: 'add' | 'del';
  readonly segments: ReadonlyArray<WordSegment>;
}) => (
  <p className={cn('flex min-w-0 gap-3 px-3 py-1.5 text-body', LINE_FILL[kind])}>
    <span aria-hidden className={cn('w-2 shrink-0', SIGN_TEXT[kind])}>
      {kind === 'add' ? '+' : '-'}
    </span>
    <span className="min-w-0 whitespace-pre-wrap break-words text-foreground [overflow-wrap:anywhere]">
      {segments.map((segment, index) => (
        <span
          key={`${index}-${segment.text}`}
          className={cn(
            segment.isChanged && kind === 'del' && 'text-muted-foreground line-through',
            segment.isChanged && kind === 'add' && 'font-medium',
          )}
        >
          {segment.text}
        </span>
      ))}
    </span>
  </p>
);

export const SourceChangeCard = ({ change }: Props) => {
  const diff = wordDiff({ before: change.before, after: change.after });
  return (
    <section
      aria-label={REVIEW_FLOW_LABEL.commentEdited}
      className="flex min-w-0 flex-col gap-2 rounded-lg bg-subtle px-4 py-3"
    >
      <SectionHeader label={REVIEW_FLOW_LABEL.commentEdited} headingLevel={2} />
      <p className="flex min-w-0 items-center gap-2 text-secondary text-muted-foreground">
        <Pencil size={ICON_SIZE.control} aria-hidden className="shrink-0" />
        <span className="min-w-0">
          {sourceChangeLine({
            author: change.author,
            time: formatClockTime({ iso: change.seenAt }),
          })}
        </span>
      </p>
      <div className="min-w-0 overflow-hidden rounded-md">
        <Line kind="del" segments={diff.before} />
        <Line kind="add" segments={diff.after} />
      </div>
    </section>
  );
};
