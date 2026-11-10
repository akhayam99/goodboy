import { Button, Notice, StatusDot } from '@goodboy/ui';
import { NAMES } from '../../../shared/utils/names';
import type { PublishRow } from './publishRowsOf';

type Props = {
  readonly row: PublishRow;
  readonly isBusy: boolean;
  readonly onRetry: () => void;
  readonly onPutBack: () => void;
};

export const PublishResultLine = ({ row, isBusy, onRetry, onPutBack }: Props) => {
  const { line } = row;
  if (line.state === 'failed') {
    return (
      <Notice
        tone="danger"
        placement="inline"
        role="alert"
        title={`Couldn't force push ${row.branch}`}
        body={line.text}
        actions={
          line.canRetry ? (
            <Button
              size="sm"
              variant="secondary"
              isBusy={isBusy}
              busyLabel="Pushing"
              onClick={onRetry}
            >
              {NAMES.retryPush}
            </Button>
          ) : null
        }
      />
    );
  }
  const isPushing = line.state === 'pushing';
  return (
    <div className="flex min-w-0 items-center gap-3 text-meta text-foreground">
      <p role="status" className="flex min-w-0 flex-1 items-center gap-2">
        <StatusDot tone={line.tone} size="sm" pulsing={isPushing} />
        <span className="min-w-0 truncate">{line.text}</span>
      </p>
      {line.canPutBack ? (
        <Button
          variant="ghost"
          size="sm"
          isBusy={isBusy}
          busyLabel="Putting back"
          onClick={onPutBack}
        >
          Put back
        </Button>
      ) : null}
    </div>
  );
};
