import { useEffect, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { Button, ConfirmPopover, ICON_SIZE, Tooltip, TruncatedText } from '@goodboy/ui';
import { LOOSE_ROW_ID } from './looseRowId';
import { useBoardContext } from './useBoardContext';

type Props = {
  readonly rowId: string;
  readonly index?: number;
};

export const BoardRowAction = ({ rowId, index = 0 }: Props) => {
  const { cardsByRowId, actionsFor, openFor, rowById } = useBoardContext();
  const [isConfirming, setIsConfirming] = useState(false);
  const card = cardsByRowId.get(rowId)?.[index];
  const row = rowById.get(rowId);
  const cardId = card?.id;
  useEffect(() => {
    setIsConfirming(false);
  }, [cardId]);
  const isLoose = rowId === LOOSE_ROW_ID;
  if (!isLoose && (row === undefined || row.isMerged)) {
    return null;
  }
  if (card === undefined) {
    const count = index === 0 && row !== undefined ? row.askIds.length : 0;
    return count === 0 ? null : (
      <span className="min-w-0 flex-1 truncate text-foreground">
        {count === 1 ? '1 open question' : `${count} open questions`}
      </span>
    );
  }
  const { main: mainVerb, failure } = actionsFor({ card });
  const open = openFor({ card });
  const onMain = () => {
    if (mainVerb === null) {
      return;
    }
    if (mainVerb.hasPicker) {
      open?.();
      return;
    }
    if (mainVerb.confirmRole !== null) {
      setIsConfirming(true);
      return;
    }
    mainVerb.run();
  };
  const button =
    mainVerb === null ? null : (
      <Button
        size="sm"
        variant="primary"
        aria-label={mainVerb.ariaLabel}
        disabled={mainVerb.isDisabled}
        isBusy={mainVerb.isBusy}
        className="pointer-events-auto shrink-0"
        onClick={onMain}
      >
        {mainVerb.label}
      </Button>
    );
  const buttonNode =
    mainVerb === null || button === null ? null : mainVerb.blockedReason !== undefined ? (
      <Tooltip content={mainVerb.blockedReason}>{button}</Tooltip>
    ) : mainVerb.confirmRole !== null ? (
      <ConfirmPopover
        role={mainVerb.confirmRole}
        icon={<CircleAlert size={ICON_SIZE.row} aria-hidden />}
        title={mainVerb.confirm?.title ?? `${mainVerb.ariaLabel ?? mainVerb.label}?`}
        description={mainVerb.confirm?.description ?? card.title}
        confirmLabel={mainVerb.confirm?.confirmLabel ?? mainVerb.label}
        isOpen={isConfirming}
        anchorClassName="flex min-w-0 items-center"
        onConfirm={() => {
          setIsConfirming(false);
          mainVerb.run();
        }}
        onCancel={() => setIsConfirming(false)}
        trigger={() => button}
      />
    ) : (
      button
    );
  return (
    <>
      <TruncatedText className="min-w-0 flex-1 text-foreground">{card.title}</TruncatedText>
      {buttonNode}
      {failure === null ? null : (
        <span role="alert" className="flex min-w-0 shrink items-center gap-1 text-danger">
          <CircleAlert size={ICON_SIZE.control} aria-hidden className="shrink-0" />
          <TruncatedText className="min-w-0">{failure}</TruncatedText>
        </span>
      )}
    </>
  );
};
