import { useEffect, useState } from 'react';
import { CircleAlert } from '@goodboy/ui/icons';
import { Button, ConfirmPopover, ICON_SIZE, Tooltip } from '@goodboy/ui';
import { MoveRebasePicker } from './MoveRebasePicker';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';
import type { CardVerb } from '../../central/next/useActionCardActions';

type Props = {
  readonly verb: CardVerb;
  readonly cardId: string;
  readonly cardTitle: string;
  readonly variant: 'primary' | 'secondary' | 'quiet';
  readonly isMain: boolean;
};

export const MoveVerb = ({ verb, cardId, cardTitle, variant, isMain }: Props) => {
  const [isConfirming, setIsConfirming] = useState(false);
  useEffect(() => {
    setIsConfirming(false);
  }, [cardId]);
  const onClick = () => {
    if (verb.confirmRole !== null) {
      setIsConfirming(true);
      return;
    }
    verb.run();
  };
  const pick = verb.picker;
  if (pick !== null) {
    const look = actionButtonLookOf({ verb: verb.label, variant });
    return (
      <MoveRebasePicker
        pick={pick}
        trigger={({ isOpen, toggle }) => (
          <Button
            size="sm"
            variant={look.variant}
            intent={look.intent}
            aria-label={verb.ariaLabel}
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            data-move-verb={isMain ? '' : undefined}
            disabled={verb.isDisabled}
            isBusy={verb.isBusy}
            className="pointer-events-auto shrink-0"
            onClick={toggle}
          >
            {verb.label}
          </Button>
        )}
      />
    );
  }
  const look = actionButtonLookOf({ verb: verb.label, variant });
  const plain = (
    <Button
      size="sm"
      variant={look.variant}
      intent={look.intent}
      aria-label={verb.ariaLabel}
      data-move-verb={isMain ? '' : undefined}
      disabled={verb.isDisabled}
      isBusy={verb.isBusy}
      className="pointer-events-auto shrink-0"
      onClick={onClick}
    >
      {verb.label}
    </Button>
  );
  if (verb.blockedReason !== undefined) {
    return <Tooltip content={verb.blockedReason}>{plain}</Tooltip>;
  }
  const button =
    variant === 'primary' ? (
      <Tooltip content={verb.ariaLabel ?? verb.label} shortcut="list.open">
        {plain}
      </Tooltip>
    ) : (
      plain
    );
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
