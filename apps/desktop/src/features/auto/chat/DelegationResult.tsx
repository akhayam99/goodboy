import { Check, MessageSquare, X } from 'lucide-react';
import { ICON_SIZE, Markdown } from '@goodboy/ui';
import { splitArtifactText } from '../../chat/utils/split-artifact-blocks';
import type { DelegationResultView } from './delegationResultOf';

type Props = {
  readonly result: DelegationResultView;
};

type CountParams = {
  readonly count: number;
};

type SummaryParams = {
  readonly summary: string | null;
};

const filesLine = ({ count }: CountParams): string =>
  count === 1 ? '1 file changed' : `${count} files changed`;

const proseOf = ({ summary }: SummaryParams): string | null => {
  if (summary === null) {
    return null;
  }
  const prose = splitArtifactText({ text: summary })
    .segments.map((segment) => (segment.kind === 'prose' ? segment.text : ''))
    .join('')
    .trim();
  return prose.length > 0 ? prose : null;
};

export const DelegationResult = ({ result }: Props) => {
  const summary = proseOf({ summary: result.summary });
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {summary === null ? null : <Markdown text={summary} className="min-w-0 text-label" />}
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
                <span className="shrink-0 text-meta text-faint-foreground">
                  claimed by the agent
                </span>
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
};
