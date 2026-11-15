import { Button, Tooltip } from '@goodboy/ui';
import { useBoardContext } from './useBoardContext';

type Props = {
  readonly rowId: string;
  readonly index: number;
};

export const BoardCardSecond = ({ rowId, index }: Props) => {
  const { cardsByRowId, actionsFor } = useBoardContext();
  const card = cardsByRowId.get(rowId)?.[index];
  if (card === undefined) {
    return null;
  }
  const { second } = actionsFor({ card });
  if (second === null) {
    return null;
  }
  const button = (
    <Button
      size="sm"
      variant="secondary"
      aria-label={second.ariaLabel}
      disabled={second.isDisabled}
      isBusy={second.isBusy}
      className="shrink-0"
      onClick={second.run}
    >
      {second.label}
    </Button>
  );
  return second.blockedReason === undefined ? (
    button
  ) : (
    <Tooltip content={second.blockedReason}>{button}</Tooltip>
  );
};
