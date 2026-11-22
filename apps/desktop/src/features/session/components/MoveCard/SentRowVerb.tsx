import { Button } from '@goodboy/ui';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';

type Props = {
  readonly label: string;
  readonly variant: 'primary' | 'secondary' | 'quiet';
  readonly onClick: () => void;
};

export const SentRowVerb = ({ label, variant, onClick }: Props) => {
  const look = actionButtonLookOf({ verb: label, variant });
  return (
    <Button size="sm" variant={look.variant} intent={look.intent} onClick={onClick}>
      {label}
    </Button>
  );
};
