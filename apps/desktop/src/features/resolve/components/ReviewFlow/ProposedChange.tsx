import { SectionHeader, Skeleton, cn } from '@goodboy/ui';
import type { FileDiff } from '@goodboy/types';
import { LINE_FILL, SIGN_TEXT } from '../../../diff/lib/lineTone';
import { inlineChangePlan } from '../../inlineChangePlan';
import { changeSummaryLine } from '../../resolveItemCopy';
import { REVIEW_FLOW_LABEL } from '../../reviewFlowCopy';

type Props = {
  readonly files: ReadonlyArray<FileDiff>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly isCompact?: boolean;
};

const COMPACT_LINE_LIMIT = 8;

const SIGN = { add: '+', del: '-', context: ' ' } as const;

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
        <div key={file.path} className="min-w-0 overflow-hidden rounded-lg bg-subtle">
          <p className="truncate px-3 pt-2 font-mono text-meta text-muted-foreground">
            {file.path}
          </p>
          {file.hunks.map((hunk) => (
            <div key={hunk.header} className="min-w-0 py-2 font-mono text-code">
              <p className="px-3 text-faint-foreground">{hunk.header}</p>
              {hunk.lines.map((line, index) => (
                <p
                  key={`${hunk.header}-${index}`}
                  className={cn('flex min-w-0 gap-3 px-3', LINE_FILL[line.kind])}
                >
                  <span aria-hidden className={cn('w-2 shrink-0', SIGN_TEXT[line.kind])}>
                    {SIGN[line.kind]}
                  </span>
                  <span className="min-w-0 whitespace-pre-wrap break-words text-foreground">
                    {line.text}
                  </span>
                </p>
              ))}
            </div>
          ))}
        </div>
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
