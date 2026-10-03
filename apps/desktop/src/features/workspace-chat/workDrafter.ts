import { MODEL_CATALOGS } from '@goodboy/core';
import {
  PROVIDER_IDS,
  isChatProvider,
  isEffortLevel,
  type EffortLevel,
  type ProviderId,
  type WorkspaceId,
} from '@goodboy/types';
import type { ChatModelChoice } from './defaultChatModel';

export type WorkDrafterChoice = ChatModelChoice & {
  readonly effort?: EffortLevel;
};

type KeyParams = {
  readonly workspaceId: WorkspaceId;
};

export const workDrafterSettingKey = ({ workspaceId }: KeyParams): string =>
  `chat.workDrafter.${workspaceId}`;

type ParseParams = {
  readonly raw: string | null;
};

const isProviderId = (value: unknown): value is ProviderId =>
  typeof value === 'string' && PROVIDER_IDS.some((candidate) => candidate === value);

export const parseWorkDrafter = ({ raw }: ParseParams): WorkDrafterChoice | null => {
  if (raw === null || raw === '') {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const provider: unknown = Reflect.get(parsed, 'provider');
    const model: unknown = Reflect.get(parsed, 'model');
    if (!isProviderId(provider) || !isChatProvider(provider) || typeof model !== 'string') {
      return null;
    }
    const isKnown = MODEL_CATALOGS[provider].some((entry) => entry.key === model);
    if (!isKnown) {
      return null;
    }
    const effort: unknown = Reflect.get(parsed, 'effort');
    return typeof effort === 'string' && isEffortLevel(effort)
      ? { provider, model, effort }
      : { provider, model };
  } catch {
    return null;
  }
};

type SerializeParams = {
  readonly choice: WorkDrafterChoice;
};

export const serializeWorkDrafter = ({ choice }: SerializeParams): string =>
  JSON.stringify({
    provider: choice.provider,
    model: choice.model,
    ...(choice.effort != null && { effort: choice.effort }),
  });
