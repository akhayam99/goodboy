import { Pencil } from 'lucide-react';
import { SectionHeader } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatClockTime } from '../../../../shared/utils/formatClockTime';
import { REVIEW_FLOW_LABEL, sourceChangeLine } from '../../reviewFlowCopy';
import type { ReviewSourceChange } from '../../sourceChangeOf';
import { wordDiff } from '../../wordDiff';
import { SourceChangeLine } from './SourceChangeLine';

type Props = {
  readonly change: ReviewSourceChange;
};

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
        <SourceChangeLine kind="del" segments={diff.before} />
        <SourceChangeLine kind="add" segments={diff.after} />
      </div>
    </section>
  );
};
