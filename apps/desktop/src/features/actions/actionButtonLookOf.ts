import type { ButtonIntent, ButtonVariant } from '@goodboy/ui';
import { actionIntentOf } from './actionIntentOf';

type Params = {
  readonly verb: string;
  readonly isNext: boolean;
};

export type ActionButtonLook = {
  readonly intent: ButtonIntent;
  readonly variant: Extract<ButtonVariant, 'primary' | 'secondary'>;
};

export const actionButtonLookOf = ({ verb, isNext }: Params): ActionButtonLook => {
  const intent = actionIntentOf({ verb });
  if (intent === 'caution' || intent === 'destructive') {
    return { intent, variant: 'secondary' };
  }
  if (isNext) {
    return { intent: 'primary', variant: 'primary' };
  }
  return { intent: 'neutral', variant: 'secondary' };
};
