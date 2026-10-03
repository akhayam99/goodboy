import { catalogModelForId, resolveRoleChoice, roleModelChoices } from '@goodboy/core';
import type { RoleModelChoice, RoleModelPreference } from '@goodboy/types';
import { modelLabel } from '../chat/utils/chat-constants';

export type RoleSetEntry = Readonly<{
  choice: RoleModelChoice;
  label: string;
  isGone: boolean;
}>;

type Params = {
  readonly preference: RoleModelPreference | null;
};

export const roleSetEntries = ({ preference }: Params): ReadonlyArray<RoleSetEntry> => {
  if (preference === null) {
    return [];
  }
  return roleModelChoices({ preference }).map((choice) => {
    const resolved = resolveRoleChoice({ choice, effort: preference.effort });
    if (resolved === null) {
      return { choice, label: modelLabel(choice.model, choice.providerId), isGone: true };
    }
    const catalog = catalogModelForId({ provider: resolved.provider, modelId: resolved.model });
    return {
      choice,
      label: catalog?.label ?? modelLabel(resolved.model, resolved.provider),
      isGone: false,
    };
  });
};
