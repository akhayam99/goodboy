import { MODEL_CATALOGS } from '@goodboy/core';
import { isChatProvider, type CatalogModel, type ModelKey, type ProviderId } from '@goodboy/types';

export type ChatModelChoice = {
  readonly provider: ProviderId;
  readonly model: ModelKey;
};

const PREFERRED_CHAT_MODEL: ChatModelChoice = { provider: 'anthropic', model: 'sonnet-5' };

type Params = {
  readonly connected: ReadonlyArray<ProviderId>;
};

type ProviderParams = {
  readonly provider: ProviderId;
};

export const firstChatModelOf = ({ provider }: ProviderParams): ModelKey | null => {
  const catalog: ReadonlyArray<CatalogModel> = MODEL_CATALOGS[provider];
  const current = catalog.filter((model) => model.legacy !== true);
  return (current.find((model) => model.tier === 'turn') ?? current[0] ?? catalog[0])?.key ?? null;
};

export const defaultChatModel = ({ connected }: Params): ChatModelChoice => {
  if (connected.includes(PREFERRED_CHAT_MODEL.provider)) {
    return PREFERRED_CHAT_MODEL;
  }
  const provider = connected.find((candidate) => isChatProvider(candidate));
  if (provider === undefined) {
    return PREFERRED_CHAT_MODEL;
  }
  const model = firstChatModelOf({ provider });
  return model === null ? PREFERRED_CHAT_MODEL : { provider, model };
};
