import type { AgentRole, RoleModelPreferences } from '@goodboy/types';
import { roleSetEntries } from '../providers/roleSetEntries';
import { roleSetNoun } from '../providers/roleSetNoun';

type Params = {
  readonly role: AgentRole;
  readonly roleModels: RoleModelPreferences | null;
};

export const roleSetLine = ({ role, roleModels }: Params): string | null => {
  const entries = roleSetEntries({ preference: roleModels?.[role] ?? null });
  const first = entries.find((entry) => !entry.isGone);
  if (first === undefined) {
    return null;
  }
  const noun = roleSetNoun(role);
  return `${noun.charAt(0).toUpperCase()}${noun.slice(1)} models · ${first.label}`;
};
