import {
  AUTO_DEFAULTS,
  MODEL_CATALOGS,
  isCuratedProvider,
  resolveRoleRouting,
  type AutoContext,
  type ResolvedRoleRouting,
} from '@goodboy/core';
import type { AgentRole, CatalogModel, ProviderId, RoleModelPreferences } from '@goodboy/types';
import { PROVIDER_LABEL } from '../providers/providerLabel';
import {
  routingLabelParts,
  routingNameText,
} from '../../shared/components/RoutingPicker/routingSummary';
import { ROLE_LABEL, type AgentKindRouting } from './agent-kind';

export type SuggestedRouting = {
  readonly routing: AgentKindRouting;
  readonly reason: string;
};

type Params = {
  readonly role: AgentRole;
  readonly roleModels: RoleModelPreferences | null;
  readonly auto: AutoContext;
  readonly workspaceName: string | null;
};

type ReasonParams = Params & {
  readonly resolved: ResolvedRoleRouting;
};

type NameParams = {
  readonly provider: ProviderId;
  readonly model: string;
};

const modelName = ({ provider, model }: NameParams): string =>
  routingNameText(routingLabelParts({ provider, model }));

type WantedParams = {
  readonly provider: ProviderId;
  readonly role: AgentRole;
};

const wantedModel = ({ provider, role }: WantedParams): CatalogModel | null => {
  if (!isCuratedProvider(provider)) {
    return null;
  }
  const column = AUTO_DEFAULTS[provider][role];
  const key = column[0]?.key;
  const catalog: ReadonlyArray<CatalogModel> = MODEL_CATALOGS[provider];
  return catalog.find((candidate) => candidate.key === key) ?? null;
};

const reasonFor = ({ role, auto, workspaceName, resolved }: ReasonParams): string => {
  const roleLabel = ROLE_LABEL[role];
  const providerLabel = PROVIDER_LABEL[resolved.provider];
  const picked = modelName({ provider: resolved.provider, model: resolved.model });
  if (resolved.pinnedUnavailable != null) {
    return `Pinned ${modelName(resolved.pinnedUnavailable)} is not available. Auto picked ${picked} instead.`;
  }
  if (resolved.isOverride) {
    return `You pinned this for ${roleLabel} in Defaults.`;
  }
  switch (resolved.autoStep) {
    case 'next-in-column': {
      const wanted = wantedModel({ provider: resolved.provider, role });
      if (wanted?.minCliVersion == null) {
        return `${roleLabel} default on ${providerLabel}.`;
      }
      return `${wanted.label} needs the ${providerLabel} CLI ${wanted.minCliVersion}. Using ${picked} instead.`;
    }
    case 'next-provider':
      return `${PROVIDER_LABEL[auto.defaultProvider]} is not available. ${providerLabel} is next in your fallback order.`;
    case 'cost-tier':
      return `${providerLabel} has no default for ${roleLabel}. Goodboy picked its closest model.`;
    case 'curated':
    case undefined:
      return `${roleLabel} default on ${providerLabel}, the default provider in ${workspaceName ?? 'this workspace'}.`;
    default: {
      const exhaustive: never = resolved.autoStep;
      throw new Error(`unknown auto step: ${String(exhaustive)}`);
    }
  }
};

export const suggestedRouting = (params: Params): SuggestedRouting => {
  const resolved = resolveRoleRouting({
    role: params.role,
    prefs: params.roleModels,
    auto: params.auto,
  });
  return {
    routing: { provider: resolved.provider, model: resolved.model, effort: resolved.effort },
    reason: reasonFor({ ...params, resolved }),
  };
};
