import { useEffect, useState } from 'react';
import { CircleAlert } from '@goodboy/ui/icons';
import { Button, ConfirmPopover, ICON_SIZE, Tooltip } from '@goodboy/ui';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';
import type { CardVerb } from '../../central/next/useActionCardActions';

type Props = {
  readonly verb: CardVerb;
  readonly cardId: string;
  readonly cardTitle: string;
  readonly variant: 'primary' | 'secondary';
  readonly onOpen: (() => void) | null;
};

export const MoveVerb = ({ verb, cardId, cardTitle, variant, onOpen }: Props) => {
  const [isConfirming, setIsConfirming] = useState(false);
  useEffect(() => {
    setIsConfirming(false);
  }, [cardId]);
  const onClick = () => {
    if (verb.hasPicker) {
      onOpen?.();
      return;
    }
    if (verb.confirmRole !== null) {
      setIsConfirming(true);
      return;
    }
    verb.run();
  };
  const look = actionButtonLookOf({ verb: verb.label, variant });
  const button = (
    <Button
      size="sm"
      variant={look.variant}
      intent={look.intent}
      aria-label={verb.ariaLabel}
      disabled={verb.isDisabled}
      isBusy={verb.isBusy}
      className="pointer-events-auto shrink-0"
      onClick={onClick}
    >
      {verb.label}
    </Button>
  );
  if (verb.blockedReason !== undefined) {
    return <Tooltip content={verb.blockedReason}>{button}</Tooltip>;
  }
  if (verb.confirmRole === null) {
    return button;
  }
  return (
    <ConfirmPopover
      role={verb.confirmRole}
      icon={<CircleAlert size={ICON_SIZE.row} aria-hidden />}
      title={verb.confirm?.title ?? `${verb.ariaLabel ?? verb.label}?`}
      description={verb.confirm?.description ?? cardTitle}
      confirmLabel={verb.confirm?.confirmLabel ?? verb.label}
      isOpen={isConfirming}
      anchorClassName="flex min-w-0 items-center"
      onConfirm={() => {
        setIsConfirming(false);
        verb.run();
      }}
      onCancel={() => setIsConfirming(false)}
      trigger={() => button}
    />
  );
};
