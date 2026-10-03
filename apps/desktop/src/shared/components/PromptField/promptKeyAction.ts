import { isSubmitChord } from '../../keyboard/isSubmitChord';
import { SHORTCUTS } from '../../keyboard/registry';

export type PromptFieldKind = 'message' | 'document';

export type PromptKeyAction = 'send' | 'now' | 'none';

type KeyEvent = {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly isComposing?: boolean;
};

type Params = {
  readonly event: KeyEvent;
  readonly kind: PromptFieldKind;
  readonly canSendNow: boolean;
  readonly isClassic: boolean;
};

const ENTER_KEY = SHORTCUTS['composer.send'].combo;

export const effectiveKind = ({
  kind,
  isClassic,
}: Pick<Params, 'kind' | 'isClassic'>): PromptFieldKind =>
  kind === 'message' && isClassic ? 'document' : kind;

export const promptKeyAction = ({
  event,
  kind,
  canSendNow,
  isClassic,
}: Params): PromptKeyAction => {
  if (event.isComposing === true || event.key !== ENTER_KEY) {
    return 'none';
  }
  const keys = effectiveKind({ kind, isClassic });
  if (isSubmitChord(event)) {
    return keys === 'message' && canSendNow ? 'now' : 'send';
  }
  if (event.shiftKey || event.altKey) {
    return 'none';
  }
  return keys === 'message' ? 'send' : 'none';
};
