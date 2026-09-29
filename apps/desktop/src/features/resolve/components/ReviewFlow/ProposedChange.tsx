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
  readonly heading?: string;
};

const SIGN = { add: '+', del: '-', context: ' ' } as const;

export const ProposedChange = ({
  files,
  isLoading,
  error,
  heading = REVIEW_FLOW_LABEL.proposedChange,
}: Props) => {
  const plan = inlineChangePlan({ files });
  return (
    <section aria-label={heading} className="flex min-w-0 flex-col gap-2">
      <SectionHeader label={heading} headingLevel={2} />
      {isLoading && <Skeleton className="h-16 w-full rounded-md" />}
      {error !== null && <p className="text-secondary text-warning">{error}</p>}
      {!isLoading && error === null && files.length === 0 && (
        <p className="text-secondary text-muted-foreground">{REVIEW_FLOW_LABEL.noChangeCaptured}</p>
      )}
      {plan.files.map((file) => (
        <div key={file.path} className="min-w-0 overflow-hidden rounded-lg bg-subtle">
          <p className="truncate px-3 pt-2 font-mono text-secondary text-muted-foreground">
            {file.path}
          </p>
          {file.hunks.map((hunk) => (
            <div key={hunk.header} className="min-w-0 py-1.5 font-mono text-code">
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
      {plan.kind !== 'whole' && files.length > 0 && (
        <p className="text-secondary text-muted-foreground">
          {plan.kind === 'too_large' ? `${REVIEW_FLOW_LABEL.tooLarge} ` : ''}
          {changeSummaryLine({ fileCount: files.length, changedLines: plan.changedLines })}
        </p>
      )}
    </section>
  );
};
