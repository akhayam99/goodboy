import { Button, FieldRow } from '@goodboy/ui';
import { useNow } from '../../../shared/hooks/useNow';
import { useAppStore } from '../../../store';
import { checkedLine } from '../checkedLine';
import { useUpdateCard } from '../hooks/useUpdateCard';
import { updatePillLabel } from '../updateCardCopy';
import { UpdateVerbButtons } from './UpdateVerbButtons';

type Props = {
  readonly installedVersion: string | null;
};

export const UpdateVersionRow = ({ installedVersion }: Props) => {
  const status = useAppStore((state) => state.updaterStatus);
  const failure = useAppStore((state) => state.updateFailure);
  const checkedAt = useAppStore((state) => state.updateCheckedAt);
  const checkForUpdates = useAppStore((state) => state.checkForUpdates);
  const card = useUpdateCard();
  const now = useNow(30_000);
  const name = installedVersion === null ? 'Goodboy' : `Goodboy ${installedVersion}`;

  if (card.state === null || card.copy === null) {
    const isCheckFailed = failure?.phase === 'check';
    return (
      <FieldRow
        label={name}
        help={
          <span
            role={isCheckFailed ? 'status' : undefined}
            className={isCheckFailed ? 'text-danger' : ''}
          >
            {checkedLine({ status, failure, checkedAt, now })}
          </span>
        }
      >
        <Button
          variant="secondary"
          size="sm"
          isBusy={status === 'checking'}
          busyLabel="Checking"
          onClick={() => void checkForUpdates()}
        >
          Check for updates
        </Button>
      </FieldRow>
    );
  }

  const { copy } = card;
  const headline = updatePillLabel({
    state: card.state,
    version: card.version,
    runningCount: card.runningCount,
  });

  return (
    <FieldRow
      label={name}
      help={
        <span className="flex min-w-0 flex-col">
          <span className="text-foreground">{headline}</span>
          <span>{headline === copy.title ? copy.body : `${copy.title}. ${copy.body}`}</span>
          {copy.detail === null ? null : (
            <span className="text-faint-foreground">{copy.detail}</span>
          )}
        </span>
      }
    >
      <span className="flex items-center gap-2">
        <UpdateVerbButtons verbs={card.verbs} />
      </span>
    </FieldRow>
  );
};
