import type { DurationEstimate, EstimateKey } from '@goodboy/core';
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

const stepsOf = ({ count, role }: { readonly count: number; readonly role: string }) =>
  `${count} finished ${role} ${count === 1 ? 'step' : 'steps'}`;

type Params = {
  readonly estimate: DurationEstimate;
  readonly key: EstimateKey;
};

const basisScope = ({ estimate, key }: Params): string => {
  const role = ROLE_LABEL[key.role].toLowerCase();
  const steps = stepsOf({ count: estimate.sampleCount, role });
  const route = routeName({ key });
  const provider = providerName({ provider: key.provider }) ?? 'one provider';
  const model = key.model === null ? 'this model' : modelLabel(key.model);
  switch (estimate.tier) {
    case 'exact':
      return route === null ? steps : `${steps} on ${route}`;
    case 'model':
      return `${steps} on ${model} at any effort`;
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

export const estimateBasis = ({ estimate, key }: Params): string => {
  const route = routeName({ key });
  const missing =
    route === null || estimate.tier === 'exact' || estimate.tier === 'runs'
      ? ''
      : `Not enough runs on ${route} yet. `;
  const sized =
    estimate.size === null
      ? ''
      : `The planner sized this step ${estimate.size}, so this is ${SIZE_BAND[estimate.size]} past runs. `;
  return `${sized}${missing}Based on ${basisScope({ estimate, key })}, ${WINDOW_NOTE}`;
};

export const estimateBasisShort = ({ estimate, key }: Params): string =>
  estimate.size === null
    ? `based on ${basisScope({ estimate, key })}`
    : `sized ${estimate.size}, based on ${basisScope({ estimate, key })}`;

export const unknownEstimateBasis = ({ key }: KeyParams): string => {
  const role = ROLE_LABEL[key.role];
  const route = routeName({ key });
  return route === null
    ? `Not enough finished ${role.toLowerCase()} steps yet to estimate.`
    : `Not enough finished ${role.toLowerCase()} steps on ${route} yet to estimate.`;
};
