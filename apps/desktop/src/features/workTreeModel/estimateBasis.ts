import type { DurationEstimate, DurationUnit, EstimateKey, EstimateProgress } from '@goodboy/core';
import { PROVIDER_IDS, type StepSize } from '@goodboy/types';
import { EFFORT_LABEL, modelLabel } from '../chat/utils/chat-constants';
import { PROVIDER_LABEL } from '../providers/providerLabel';
import { ROLE_LABEL } from '../session/agent-kind';

const WINDOW_NOTE = 'last 90 days. Machine time only.';

const effortName = ({ effort }: { readonly effort: string | null }): string | null => {
  if (effort === null) {
    return null;
  }
  const label = Object.entries(EFFORT_LABEL).find(([level]) => level === effort)?.[1];
  return (label ?? effort).toLowerCase();
};

const providerName = ({ provider }: { readonly provider: string | null }): string | null => {
  if (provider === null) {
    return null;
  }
  const known = PROVIDER_IDS.find((providerId) => providerId === provider);
  return known === undefined ? provider : PROVIDER_LABEL[known];
};

type KeyParams = {
  readonly key: EstimateKey;
};

const routeName = ({ key }: KeyParams): string | null => {
  if (key.model === null) {
    return providerName({ provider: key.provider });
  }
  const effort = effortName({ effort: key.effort });
  return effort === null ? modelLabel(key.model) : `${modelLabel(key.model)} ${effort}`;
};

const UNIT_NAME: Record<DurationUnit, { readonly one: string; readonly many: string }> = {
  step: { one: 'step', many: 'steps' },
  turn: { one: 'turn', many: 'turns' },
};

type CountParams = {
  readonly count: number;
  readonly role: string;
  readonly unit: DurationUnit;
};

const stepsOf = ({ count, role, unit }: CountParams) =>
  `${count} finished ${role} ${count === 1 ? UNIT_NAME[unit].one : UNIT_NAME[unit].many}`;

type Params = {
  readonly estimate: DurationEstimate;
  readonly key: EstimateKey;
  readonly unit: DurationUnit;
};

const basisScope = ({ estimate, key, unit }: Params): string => {
  const role = ROLE_LABEL[key.role].toLowerCase();
  const steps = stepsOf({ count: estimate.sampleCount, role, unit });
  const route = routeName({ key });
  const provider = providerName({ provider: key.provider }) ?? 'one provider';
  const model = key.model === null ? 'this model' : modelLabel(key.model);
  switch (estimate.tier) {
    case 'exact':
      return route === null ? steps : `${steps} on ${route}`;
    case 'model':
      return `${steps} on ${model} at any effort`;
    case 'modelAnyWorkspace':
      return `${steps} on ${route ?? model} across your workspaces`;
    case 'provider':
      return `${steps} on any ${provider} model`;
    case 'role':
      return `${steps} on any model`;
    case 'runs':
      return `${estimate.sampleCount} past orchestrated ${estimate.sampleCount === 1 ? 'run' : 'runs'}`;
    default: {
      const exhaustive: never = estimate.tier;
      return exhaustive;
    }
  }
};

const SIZE_BAND: Record<StepSize, string> = {
  small: 'the faster half of',
  medium: 'the middle of',
  large: 'the slower half of',
};

const missingNote = ({ estimate, key }: Omit<Params, 'unit'>): string => {
  const route = routeName({ key });
  if (route === null || estimate.tier === 'exact' || estimate.tier === 'runs') {
    return '';
  }
  return estimate.tier === 'modelAnyWorkspace'
    ? `Not enough runs on ${route} in this workspace yet. `
    : `Not enough runs on ${route} yet. `;
};

export const estimateBasis = ({ estimate, key, unit }: Params): string => {
  const missing = missingNote({ estimate, key });
  const sized =
    estimate.size === null
      ? ''
      : `The planner sized this step ${estimate.size}, so this is ${SIZE_BAND[estimate.size]} past runs. `;
  return `${sized}${missing}Based on ${basisScope({ estimate, key, unit })}, ${WINDOW_NOTE}`;
};

export const estimateBasisShort = ({ estimate, key, unit }: Params): string =>
  estimate.size === null
    ? `based on ${basisScope({ estimate, key, unit })}`
    : `sized ${estimate.size}, based on ${basisScope({ estimate, key, unit })}`;

type UnknownParams = KeyParams & {
  readonly unit: DurationUnit;
  readonly progress?: EstimateProgress | null;
};

type ScopeParams = KeyParams & {
  readonly progress: EstimateProgress;
};

const progressScope = ({ key, progress }: ScopeParams): string => {
  const route = routeName({ key });
  const model = key.model === null ? 'this model' : modelLabel(key.model);
  const provider = providerName({ provider: key.provider }) ?? 'one provider';
  switch (progress.tier) {
    case 'exact':
      return route === null ? '' : ` on ${route}`;
    case 'model':
      return ` on ${model}`;
    case 'modelAnyWorkspace':
      return ` on ${route ?? model} across your workspaces`;
    case 'provider':
      return ` on any ${provider} model`;
    case 'role':
      return ' on any model';
    default: {
      const exhaustive: never = progress.tier;
      return exhaustive;
    }
  }
};

export const unknownEstimateBasis = ({ key, unit, progress = null }: UnknownParams): string => {
  const role = ROLE_LABEL[key.role].toLowerCase();
  const route = routeName({ key });
  const units = UNIT_NAME[unit].many;
  if (progress !== null) {
    return `No estimate yet: ${progress.have} of ${progress.need} finished ${role} ${units}${progressScope({ key, progress })}.`;
  }
  return route === null
    ? `Not enough finished ${role} ${units} yet to estimate.`
    : `Not enough finished ${role} ${units} on ${route} yet to estimate.`;
};
