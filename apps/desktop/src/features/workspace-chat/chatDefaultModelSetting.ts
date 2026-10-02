import { MODEL_CATALOGS } from '@goodboy/core';
import {
  CHAT_PROVIDER_IDS,
  isEffortLevel,
  type ChatProviderId,
  type EffortLevel,
  type WorkspaceId,
} from '@goodboy/types';
import type { ChatRouting } from './chatRouting';

type KeyParams = {
  readonly workspaceId: WorkspaceId;
};

type ParseParams = {
  readonly raw: string | null | undefined;
};

type SerializeParams = {
  readonly routing: ChatRouting;
};

const chatProviderOf = (value: unknown): ChatProviderId | null =>
  CHAT_PROVIDER_IDS.find((candidate) => candidate === value) ?? null;

const effortOf = (value: unknown): EffortLevel | null =>
  typeof value === 'string' && isEffortLevel(value) ? value : null;

export const chatDefaultModelKey = ({ workspaceId }: KeyParams): string =>
  `chat.default_model.${workspaceId}`;

export const parseChatDefaultModel = ({ raw }: ParseParams): ChatRouting | null => {
  if (raw === null || raw === undefined) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const provider = chatProviderOf(Reflect.get(parsed, 'provider'));
    const model: unknown = Reflect.get(parsed, 'model');
    if (provider === null || typeof model !== 'string') {
      return null;
    }
    if (!MODEL_CATALOGS[provider].some((candidate) => candidate.key === model)) {
      return null;
    }
    return { provider, model, effort: effortOf(Reflect.get(parsed, 'effort')) };
  } catch {
    return null;
  }
};

export const serializeChatDefaultModel = ({ routing }: SerializeParams): string =>
  JSON.stringify({ provider: routing.provider, model: routing.model, effort: routing.effort });
