import type { PromptKeyHint } from './PromptKeysHint';
import type { PromptFieldKind } from './promptKeyAction';

export type PromptKeyLabels = {
  readonly send: string;
  readonly now?: string;
};

type Params = {
  readonly kind: PromptFieldKind;
  readonly labels: PromptKeyLabels | undefined;
  readonly canSendNow: boolean;
};

export const keyHintsOf = ({ kind, labels, canSendNow }: Params): ReadonlyArray<PromptKeyHint> => {
  if (labels === undefined) {
    return [];
  }
  if (kind === 'document') {
    return [
      { id: 'composer.send', label: 'new line' },
      { id: 'composer.submit', label: labels.send },
    ];
  }
  const hints: PromptKeyHint[] = [
    { id: 'composer.send', label: labels.send },
    { id: 'composer.newLine', label: 'new line' },
  ];
  if (canSendNow && labels.now !== undefined) {
    hints.push({ id: 'composer.submit', label: labels.now });
  }
  return hints;
};
