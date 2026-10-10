import { providerStanding, resolveRoleRouting, type AutoContext } from '@goodboy/core';
import type {
  AgentEffort,
  AgentRole,
  ProviderId,
  RoleModelPreference,
  RoleModelPreferences,
} from '@goodboy/types';
import { skippedPinLine } from '../skippedPinLine';

export type RoleResolution = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: AgentEffort;
  readonly isPinned: boolean;
  readonly skippedLine: string | null;
  readonly isPinUnrunnable: boolean;
};

type Params = {
  readonly role: AgentRole;
  readonly preference: RoleModelPreference | null;
  readonly autoContext: AutoContext;
};

export const roleResolution = ({ role, preference, autoContext }: Params): RoleResolution => {
  const prefs: RoleModelPreferences | null = preference === null ? null : { [role]: preference };
  const routing = resolveRoleRouting({ role, prefs, auto: autoContext });
  const skipped = routing.pinnedUnavailable;
  return {
    provider: routing.provider,
    model: routing.model,
    effort: routing.effort,
    isPinned: preference !== null,
    skippedLine:
      skipped === undefined
        ? null
        : skippedPinLine({
            pinned: skipped,
            using: routing,
            standing: providerStanding({ provider: skipped.provider, context: autoContext }),
          }),
    isPinUnrunnable: skipped !== undefined && !routing.isOverride,
  };
};
