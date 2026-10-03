import { latestInGroup, type ModelLine } from '@goodboy/core';
import {
  isChatProvider,
  type ChatProviderId,
  type ModelKey,
  type ProviderId,
} from '@goodboy/types';

export type ChatModelChoice = {
  readonly provider: ProviderId;
  readonly model: ModelKey;
};

const CHAT_LINE: Readonly<Record<ChatProviderId, ModelLine>> = {
  anthropic: { group: 'Sonnet' },
  codex: { group: 'GPT', checkpoint: 'Terra' },
};

const PREFERRED_CHAT_PROVIDER: ChatProviderId = 'anthropic';

type ProviderParams = {
  readonly provider: ProviderId;
};

export const chatModelOf = ({ provider }: ProviderParams): ModelKey | null => {
  if (!isChatProvider(provider)) {
    return null;
  }
  return latestInGroup({ provider, ...CHAT_LINE[provider] })[0]?.key ?? null;
};

type Params = {
  readonly connected: ReadonlyArray<ProviderId>;
};

const choiceFor = ({ provider }: ProviderParams): ChatModelChoice | null => {
  const model = chatModelOf({ provider });
  return model === null ? null : { provider, model };
};

const preferredChoice = (): ChatModelChoice => {
  const choice = choiceFor({ provider: PREFERRED_CHAT_PROVIDER });
  if (choice === null) {
    throw new Error(`no chat model line for ${PREFERRED_CHAT_PROVIDER}`);
  }
  return choice;
};

export const defaultChatModel = ({ connected }: Params): ChatModelChoice => {
  if (connected.includes(PREFERRED_CHAT_PROVIDER)) {
    return preferredChoice();
  }
  const provider = connected.find((candidate) => isChatProvider(candidate));
  if (provider === undefined) {
    return preferredChoice();
  }
  return choiceFor({ provider }) ?? preferredChoice();
};
