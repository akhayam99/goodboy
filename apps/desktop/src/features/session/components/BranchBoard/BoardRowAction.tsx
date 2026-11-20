import { useEffect, useState } from 'react';
import { CircleAlert } from '@goodboy/ui/icons';
import { Button, ConfirmPopover, ICON_SIZE, Tooltip, TruncatedText } from '@goodboy/ui';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';
import { LOOSE_ROW_ID } from './looseRowId';
import { useBoardContext } from './useBoardContext';

type Props = {
  readonly rowId: string;
  readonly index?: number;
  readonly isLead?: boolean;
  readonly text?: string;
};

export const BoardRowAction = ({ rowId, index = 0, isLead = true, text }: Props) => {
  const { cardsByRowId, actionsFor, openFor, rowById } = useBoardContext();
  const [isConfirming, setIsConfirming] = useState(false);
  const card = cardsByRowId.get(rowId)?.[index];
  const row = rowById.get(rowId);
  const cardId = card?.id;
  useEffect(() => {
    setIsConfirming(false);
  }, [cardId]);
  const isLoose = rowId === LOOSE_ROW_ID;
  if (!isLoose && (row === undefined || row.isSettled)) {
    return null;
  }
  if (card === undefined) {
    const count = index === 0 && row !== undefined ? row.askIds.length : 0;
    const fallback = count === 1 ? '1 open question' : `${count} open questions`;
    const shown = text ?? (count === 0 ? '' : fallback);
    return shown === '' ? null : (
      <span className="min-w-0 flex-1 truncate text-foreground">{shown}</span>
    );
  }
  const shownTitle = text ?? card.title;
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
  const look = actionButtonLookOf({
    verb: mainVerb?.label ?? '',
    variant: isLead ? 'primary' : 'secondary',
  });
  const button =
    mainVerb === null ? null : (
      <Button
        size="sm"
        variant={look.variant}
        intent={look.intent}
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
      {shownTitle === '' ? (
        <span aria-hidden className="min-w-0 flex-1" />
      ) : (
        <TruncatedText className="min-w-0 flex-1 text-foreground">{shownTitle}</TruncatedText>
      )}
      {buttonNode}
      {failure === null ? null : (
        <span role="alert" className="flex min-w-0 shrink items-center gap-1 text-foreground">
          <CircleAlert size={ICON_SIZE.control} aria-hidden className="shrink-0 text-danger" />
          <TruncatedText className="min-w-0">{failure}</TruncatedText>
        </span>
      )}
    </>
  );
};
