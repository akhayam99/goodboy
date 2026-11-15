import type { ButtonIntent, ButtonVariant } from '@goodboy/ui';
import { actionIntentOf } from './actionIntentOf';
import { isStopVerb } from './isStopVerb';

type LookVariant = Extract<ButtonVariant, 'primary' | 'secondary' | 'ghost' | 'quiet'>;

type Params = {
  readonly verb: string;
  readonly variant: LookVariant;
};

export type ActionButtonLook = {
  readonly intent: ButtonIntent;
  readonly variant: LookVariant;
};

export const actionButtonLookOf = ({ verb, variant }: Params): ActionButtonLook => {
  const intent = actionIntentOf({ verb });
  if (isStopVerb({ verb })) {
    return { intent, variant: 'quiet' };
  }
  const rest = variant === 'primary' ? 'secondary' : variant;
  if (intent === 'caution' || intent === 'destructive') {
    return { intent, variant: rest };
  }
  if (variant === 'primary') {
    return { intent: 'primary', variant: 'primary' };
  }
  return { intent: 'neutral', variant: rest };
};
