import { catalogModelForId, modelIdForSelection } from '@goodboy/core';
import { isEffortLevel, type EffortLevel, type ModelKey, type ProviderId } from '@goodboy/types';
import type { ChatModelChoice } from './defaultChatModel';
import { resolveChatModel } from './resolveChatModel';

export type ChatRouting = ChatModelChoice & {
  readonly effort: EffortLevel | null;
};

const DEFAULT_CHAT_EFFORT: EffortLevel = 'medium';

export const shownChatEffort = ({ provider, model, effort }: ChatRouting): EffortLevel => {
  if (effort !== null) {
    return effort;
  }
  try {
    const resolved = resolveChatModel({ provider, modelKey: model }).effort;
    return resolved !== undefined && isEffortLevel(resolved) ? resolved : DEFAULT_CHAT_EFFORT;
  } catch {
    return DEFAULT_CHAT_EFFORT;
  }
};

type ModelKeyParams = {
  readonly provider: ProviderId;
  readonly model: ModelKey;
};

type ModelIdParams = {
  readonly provider: ProviderId;
  readonly modelId: string;
};

export const chatModelId = ({ provider, model }: ModelKeyParams): string => {
  try {
    return modelIdForSelection({ provider, selection: { key: model } });
  } catch {
    return model;
  }
};

export const chatModelKey = ({ provider, modelId }: ModelIdParams): ModelKey =>
  catalogModelForId({ provider, modelId })?.key ?? modelId;
