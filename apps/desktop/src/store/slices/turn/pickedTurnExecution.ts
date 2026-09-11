import { canonicalModelId, modelIdForSelection } from '@goodboy/core';
import type { TurnProviderOverride } from '@goodboy/types';

export type PickedTurnExecution =
  | { readonly kind: 'unspecified' }
  | { readonly kind: 'unresolved'; readonly id: string }
  | { readonly kind: 'resolved'; readonly id: string };

type Params = {
  readonly override: TurnProviderOverride | undefined;
};

export const pickedTurnExecution = ({ override }: Params): PickedTurnExecution => {
  if (override == null) {
    return { kind: 'unspecified' };
  }
  const provider = override.providerId;
  const selection = override.selection;
  if (selection != null) {
    if (canonicalModelId({ provider, modelId: selection.key }) == null) {
      return { kind: 'unresolved', id: override.model ?? selection.key };
    }
    return { kind: 'resolved', id: modelIdForSelection({ provider, selection }) };
  }
  if (override.model == null) {
    return { kind: 'unspecified' };
  }
  const canonical = canonicalModelId({ provider, modelId: override.model });
  if (canonical == null) {
    return { kind: 'unresolved', id: override.model };
  }
  return { kind: 'resolved', id: canonical };
};
