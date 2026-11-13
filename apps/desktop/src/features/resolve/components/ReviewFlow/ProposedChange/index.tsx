import { SectionHeader, Skeleton } from '@goodboy/ui';
import type { FileDiff } from '@goodboy/types';
import { FileChangeCard } from '../../../../diff/FileChangeCard';
import { inlineChangePlan } from '../../../inlineChangePlan';
import { changeSummaryLine } from '../../../resolveItemCopy';
import { REVIEW_FLOW_LABEL } from '../../../reviewFlowCopy';

type Props = {
  readonly files: ReadonlyArray<FileDiff>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly isCompact?: boolean;
};

const COMPACT_LINE_LIMIT = 8;

export const ProposedChange = ({ files, isLoading, error, isCompact = false }: Props) => {
  const plan = inlineChangePlan({ files });
  let budget = COMPACT_LINE_LIMIT;
  const shownFiles = isCompact
    ? plan.files.flatMap((file) =>
        budget <= 0
          ? []
          : [
              {
                ...file,
                hunks: file.hunks.flatMap((hunk) => {
                  if (budget <= 0) {
                    return [];
                  }
                  const lines = hunk.lines.slice(0, budget);
                  budget -= lines.length;
                  return [{ ...hunk, lines }];
                }),
              },
            ],
      )
    : plan.files;
  return (
    <div
      role="group"
      aria-label={REVIEW_FLOW_LABEL.proposedChange}
      className="flex min-w-0 flex-col gap-2"
    >
      {!isCompact && <SectionHeader label={REVIEW_FLOW_LABEL.proposedChange} headingLevel={2} />}
      {isLoading && <Skeleton className="h-16 w-full rounded-md" />}
      {error !== null && <p className="text-meta text-warning">{error}</p>}
      {!isLoading && error === null && files.length === 0 && (
        <p className="text-meta text-muted-foreground">{REVIEW_FLOW_LABEL.noChangeCaptured}</p>
      )}
      {shownFiles.map((file) => (
        <FileChangeCard key={file.path} file={file} />
      ))}
      {!isCompact && plan.kind !== 'whole' && files.length > 0 && (
        <p className="text-meta text-muted-foreground">
          {plan.kind === 'too_large' ? `${REVIEW_FLOW_LABEL.tooLarge} ` : ''}
          {changeSummaryLine({ fileCount: files.length, changedLines: plan.changedLines })}
        </p>
      )}
    </div>
  );
};
