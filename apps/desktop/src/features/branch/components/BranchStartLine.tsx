import { ICON_SIZE, tintClasses } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { BranchStart } from '../hooks/useBranchStart';

type Props = {
  readonly start: BranchStart;
};

export const BranchStartLine = ({ start }: Props) => (
  <span
    data-branch-start-line={start.step.state}
    className="flex min-w-0 flex-wrap items-center gap-x-2 text-meta text-muted-foreground"
  >
    <span className={`inline-flex items-center gap-1 ${tintClasses(start.line.tone).text}`}>
      <CONCEPT_ICONS.branch size={ICON_SIZE.row} aria-hidden />
      {start.line.word}
    </span>
    {start.line.distance === null ? null : <span>{start.line.distance}</span>}
    {start.line.check === null ? null : (
      <span className={tintClasses(start.line.check.tone).text}>{start.line.check.word}</span>
    )}
  </span>
);
