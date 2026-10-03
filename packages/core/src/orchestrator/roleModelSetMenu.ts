import type { RoleModelPreferences } from '@goodboy/types';
import { normalizeAgentRole } from '../roles';
import { resolveRoleChoice, roleModelChoices } from '../providers/role-models';
import type { OrchestratorModelOption } from './types';

type Params = {
  readonly menu: ReadonlyArray<OrchestratorModelOption>;
  readonly role: string;
  readonly prefs: RoleModelPreferences | null | undefined;
};

export const roleModelSetMenu = ({
  menu,
  role,
  prefs,
}: Params): ReadonlyArray<OrchestratorModelOption> | null => {
  const preference = prefs?.[normalizeAgentRole({ role })];
  if (preference == null) {
    return null;
  }
  const choices = roleModelChoices({ preference }).flatMap((choice) => {
    const resolved = resolveRoleChoice({ choice, effort: preference.effort });
    return resolved === null ? [] : [resolved];
  });
  const kept = choices.flatMap((choice) => {
    const option = menu.find(
      (candidate) => candidate.provider === choice.provider && candidate.model === choice.model,
    );
    return option === undefined ? [] : [option];
  });
  return kept.length === 0 ? null : kept;
};
