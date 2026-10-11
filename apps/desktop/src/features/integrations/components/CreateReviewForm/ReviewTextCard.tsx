import type { ReactNode } from 'react';
import { Button, Notice, Skeleton, Textarea } from '@goodboy/ui';
import { RotateCw } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly title: string;
  readonly body: string;
  readonly noun: string;
  readonly isWriting: boolean;
  readonly isLocked: boolean;
  readonly scribeFailure: string | null;
  readonly onTitleChange: (value: string) => void;
  readonly onBodyChange: (value: string) => void;
  readonly onRetry: () => void;
  readonly children: ReactNode;
};

const NO_TEXT = 'Scribe wrote no text.';

type FailureParams = {
  readonly failure: string;
};

const failureTitleOf = ({ failure }: FailureParams): string =>
  failure === NO_TEXT ? 'Scribe wrote no text' : "Scribe couldn't write the text";

export const ReviewTextCard = ({
  title,
  body,
  noun,
  isWriting,
  isLocked,
  scribeFailure,
  onTitleChange,
  onBodyChange,
  onRetry,
  children,
}: Props) => {
  const label = noun === 'merge request' ? 'Merge request' : 'Pull request';
  return (
    <section
      aria-label={`${label} text`}
      className="flex min-w-0 flex-col gap-3 rounded-lg bg-subtle p-4"
    >
      {isWriting ? (
        <div role="status" aria-label="Scribe is writing" className="flex flex-col gap-3">
          <Skeleton className="h-7 w-2/3" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3.5 w-3/5" />
          </div>
        </div>
      ) : (
        <>
          <input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder={`${label} title`}
            aria-label={`${label} title`}
            disabled={isLocked}
            autoFocus
            className="w-full bg-transparent text-title text-foreground outline-none placeholder:text-faint-foreground disabled:text-disabled-foreground"
          />
          <Textarea
            value={body}
            onChange={(event) => onBodyChange(event.target.value)}
            placeholder="What changed and why"
            aria-label={`${label} description`}
            disabled={isLocked}
            autoGrow
            minRows={6}
            maxRows={16}
            className="border-0 bg-transparent px-0 py-0 text-body shadow-none focus-visible:shadow-none focus-visible:ring-0 disabled:bg-transparent"
          />
        </>
      )}
      {scribeFailure !== null && (
        <Notice
          tone="danger"
          placement="inline"
          role="alert"
          title={failureTitleOf({ failure: scribeFailure })}
          body="Nothing was changed."
          detail={scribeFailure === NO_TEXT ? null : scribeFailure}
          actions={
            <Button variant="secondary" size="sm" onClick={onRetry}>
              <RotateCw size={ICON_SIZE.row} aria-hidden />
              Retry
            </Button>
          }
        />
      )}
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        <span className="shrink-0 text-meta text-faint-foreground">Markdown</span>
      </div>
    </section>
  );
};
