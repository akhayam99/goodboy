import { Button, Notice, splitErrorMessage } from '@goodboy/ui';
import type { RestoreOutcome, RestoreTarget } from '../../../../../file-versions/useChangesRestore';
import { restoreCopyOf } from '../../../../../file-versions/restoreCopyOf';

type Props = {
  readonly outcome: RestoreOutcome;
  readonly isBusy: boolean;
  readonly onConfirm: (target: RestoreTarget) => void;
  readonly onRetry: (target: RestoreTarget) => void;
  readonly onUndo: () => void;
  readonly onDismiss: () => void;
};

type SentenceParams = Readonly<{ text: string }>;

const sentenceOf = ({ text }: SentenceParams): string => {
  const trimmed = text.trim().replace(/[.]$/, '');
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}.`;
};

export const RestoreBand = ({ outcome, isBusy, onConfirm, onRetry, onUndo, onDismiss }: Props) => {
  const copy = restoreCopyOf({ outcome });
  if (outcome.kind === 'ask') {
    return (
      <Notice
        tone="warning"
        placement="inline"
        role="alert"
        title={copy.title}
        body={copy.body}
        actions={
          <>
            <Button
              variant="secondary"
              size="xs"
              isBusy={isBusy}
              disabled={isBusy}
              onClick={() => onConfirm(outcome.target)}
            >
              {copy.confirm}
            </Button>
            <Button variant="ghost" size="xs" disabled={isBusy} onClick={onDismiss}>
              Cancel
            </Button>
          </>
        }
      />
    );
  }
  if (outcome.kind === 'failed') {
    const split = splitErrorMessage({ message: outcome.message });
    const cause = split.summary === null ? '' : `${sentenceOf({ text: split.summary })} `;
    return (
      <Notice
        tone="danger"
        placement="inline"
        role="alert"
        title={copy.title}
        body={`${cause}${copy.body}`}
        detail={split.detail}
        actions={
          <Button
            variant="secondary"
            size="xs"
            isBusy={isBusy}
            disabled={isBusy}
            onClick={() => onRetry(outcome.target)}
          >
            Retry
          </Button>
        }
      />
    );
  }
  if (outcome.kind === 'nothing') {
    return (
      <Notice tone="info" placement="inline" role="status" title={copy.title} body={copy.body} />
    );
  }
  return (
    <Notice
      tone="success"
      placement="inline"
      role="status"
      title={copy.title}
      body={copy.body}
      actions={
        outcome.target.scope === 'turn' ? (
          <Button variant="secondary" size="xs" isBusy={isBusy} disabled={isBusy} onClick={onUndo}>
            Undo restore of turn {outcome.target.turnNumber}
          </Button>
        ) : null
      }
    />
  );
};
