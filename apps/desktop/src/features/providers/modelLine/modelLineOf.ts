import type { EffortLevel, ProviderId } from '@goodboy/types';
import { getModelDescriptor, getModelProvider, resolveStoredModelSelection } from '@goodboy/core';
import { EFFORT_LABEL, EFFORT_LEVELS } from '../../chat/utils/chat-constants';
import {
  routingLabelParts,
  routingNameText,
} from '../../../shared/components/RoutingPicker/routingSummary';
import { providerIdOf } from '../../../shared/utils/providerIdOf';
import { PROVIDER_LABEL } from '../providerLabel';

export type ModelLine = Readonly<{
  provider: ProviderId | null;
  name: string;
  effort: string | null;
  isUnknown: boolean;
  rawId: string | null;
}>;

type Params = {
  readonly provider: string | null;
  readonly model: string | null;
  readonly effort: string | null;
};

type ProviderParams = {
  readonly provider: string | null;
  readonly model: string | null;
};

type KnownParams = {
  readonly provider: ProviderId;
  readonly model: string;
};

type EffortParams = {
  readonly value: string | null;
};

const UNKNOWN_NAME = 'Unknown model';

const EFFORT_WORDS: ReadonlySet<string> = new Set(Object.values(EFFORT_LABEL));

const providerOf = ({ provider, model }: ProviderParams): ProviderId | null =>
  providerIdOf({ value: provider }) ?? (model === null ? null : getModelProvider(model));

const effortLevelOf = ({ value }: EffortParams): EffortLevel | null =>
  EFFORT_LEVELS.find((candidate) => candidate === value) ?? null;

const isKnownModel = ({ provider, model }: KnownParams): boolean =>
  resolveStoredModelSelection({ provider, id: model }).report?.kind !== 'unknown' ||
  getModelDescriptor({ id: model, provider }) !== null;

export const modelLineOf = ({ provider, model, effort }: Params): ModelLine | null => {
  const resolved = providerOf({ provider, model });
  if (model === null) {
    if (resolved === null) {
      return null;
    }
    return {
      provider: resolved,
      name: PROVIDER_LABEL[resolved],
      effort: null,
      isUnknown: false,
      rawId: null,
    };
  }
  if (resolved === null) {
    return { provider: null, name: UNKNOWN_NAME, effort: null, isUnknown: true, rawId: model };
  }
  const isKnown = isKnownModel({ provider: resolved, model });
  const parts = routingLabelParts({
    provider: resolved,
    model,
    effort: isKnown ? effortLevelOf({ value: effort }) : null,
  });
  return {
    provider: resolved,
    name: routingNameText(parts),
    effort: parts.detail.find((segment) => EFFORT_WORDS.has(segment)) ?? null,
    isUnknown: !isKnown,
    rawId: isKnown ? null : model,
  };
};
