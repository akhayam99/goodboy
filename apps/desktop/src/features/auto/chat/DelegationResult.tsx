import { Check, MessageSquare, X } from 'lucide-react';
import { ICON_SIZE } from '@goodboy/ui';
import type { DelegationResultView } from './delegationResultOf';

type Props = {
  readonly result: DelegationResultView;
};

type CountParams = {
  readonly count: number;
};

const filesLine = ({ count }: CountParams): string =>
  count === 1 ? '1 file changed' : `${count} files changed`;

export const DelegationResult = ({ result }: Props) => (
  <div className="flex min-w-0 flex-col gap-1">
    {result.summary === null ? null : (
      <p className="min-w-0 whitespace-pre-line text-label text-foreground">{result.summary}</p>
    )}
    {result.reasonText === null ? null : (
      <p className="text-label text-warning">{result.reasonText}</p>
    )}
    {result.changedFileCount === 0 ? null : (
      <p className="text-meta text-muted-foreground">
        {filesLine({ count: result.changedFileCount })}
      </p>
    )}
    {result.checks.length === 0 ? null : (
      <ul aria-label="Checks" className="flex min-w-0 flex-col gap-0.5">
        {result.checks.map((check) => (
          <li
            key={check.name}
            className="flex min-w-0 items-center gap-2 text-label text-muted-foreground"
          >
            {check.status === 'fail' ? (
              <X size={ICON_SIZE.control} aria-hidden className="shrink-0 text-danger" />
            ) : (
              <Check
                size={ICON_SIZE.control}
                aria-hidden
                className={
                  check.status === 'pass'
                    ? 'shrink-0 text-success'
                    : 'shrink-0 text-faint-foreground'
                }
              />
            )}
            <span className="min-w-0 truncate">{check.name}</span>
            {check.isClaimed ? (
              <span className="shrink-0 text-meta text-faint-foreground">claimed by the agent</span>
            ) : null}
          </li>
        ))}
      </ul>
    )}
    {result.questions.length === 0 ? null : (
      <ul aria-label="Open questions" className="flex min-w-0 flex-col gap-0.5">
        {result.questions.map((question) => (
          <li
            key={question}
            className="flex min-w-0 items-center gap-2 text-label text-muted-foreground"
          >
            <MessageSquare size={ICON_SIZE.control} aria-hidden className="shrink-0" />
            <span className="min-w-0">{question}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);
