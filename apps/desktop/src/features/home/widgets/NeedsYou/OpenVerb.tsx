import { Button } from '@goodboy/ui';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';

type Props = {
  readonly verb: string;
  readonly isFirst: boolean;
  readonly onOpen: () => void;
};

export const OpenVerb = ({ verb, isFirst, onOpen }: Props) => {
  const look = actionButtonLookOf({ verb, variant: isFirst ? 'primary' : 'quiet' });
  return (
    <Button
      size="sm"
      variant={look.variant}
      intent={look.intent}
      data-home-verb=""
      onClick={onOpen}
    >
      {verb}
    </Button>
  );
};
