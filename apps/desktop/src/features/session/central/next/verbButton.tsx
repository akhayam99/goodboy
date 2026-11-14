import { Button, Tooltip } from '@goodboy/ui';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';
import type { CardVerb } from './useActionCardActions';

type VerbButtonParams = {
  readonly verb: CardVerb;
  readonly variant: 'primary' | 'secondary';
  readonly isPickerOpen?: boolean;
  readonly onClick: () => void;
};

export const verbButton = ({ verb, variant, isPickerOpen, onClick }: VerbButtonParams) => {
  const look = actionButtonLookOf({ verb: verb.label, isNext: variant === 'primary' });
  const button = (
    <Button
      size="sm"
      variant={look.variant}
      intent={look.intent}
      aria-label={verb.ariaLabel}
      aria-expanded={verb.hasPicker ? isPickerOpen : undefined}
      disabled={verb.isDisabled}
      isBusy={verb.isBusy}
      onClick={onClick}
    >
      {verb.label}
    </Button>
  );
  return verb.blockedReason === undefined ? (
    button
  ) : (
    <Tooltip content={verb.blockedReason}>{button}</Tooltip>
  );
};
