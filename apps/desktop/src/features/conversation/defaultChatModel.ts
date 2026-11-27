import {
  getDefaultTurnModel,
  isModelHidden,
  latestInGroup,
  type HiddenModels,
  type ModelLine,
} from '@goodboy/core/providers';
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
  codex: { group: 'GPT', checkpoint: 'Sol' },
};

const PREFERRED_CHAT_PROVIDER: ChatProviderId = 'anthropic';

type ProviderParams = {
  readonly provider: ProviderId;
  readonly hidden?: HiddenModels | null;
};

type LineParams = {
  readonly provider: ChatProviderId;
};

const chatLineOf = ({ provider }: LineParams) => {
  const line = latestInGroup({ provider, ...CHAT_LINE[provider] });
  const turnDefault = getDefaultTurnModel({ id: provider });
  const start = Math.max(
    line.findIndex((model) => model.key === turnDefault),
    0,
  );
  const fromDefault = [...line.slice(start), ...line.slice(0, start)];
  return [
    ...fromDefault.filter((model) => model.presentation.costTier !== 'expensive'),
    ...fromDefault.filter((model) => model.presentation.costTier === 'expensive'),
  ];
};

const chatModelOf = ({ provider, hidden = null }: ProviderParams): ModelKey | null => {
  if (!isChatProvider(provider)) {
    return null;
  }
  return (
    chatLineOf({ provider }).find(
      (model) => hidden === null || !isModelHidden({ provider, hidden, key: model.key }),
    )?.key ?? null
  );
};

type Params = {
  readonly connected: ReadonlyArray<ProviderId>;
  readonly workspaceDefaultProvider?: ProviderId | null;
  readonly hidden?: HiddenModels | null;
};

const choiceFor = ({ provider, hidden }: ProviderParams): ChatModelChoice | null => {
  const model = chatModelOf({ provider, hidden });
  return model === null ? null : { provider, model };
};

const preferredChoice = ({ hidden }: Pick<ProviderParams, 'hidden'>): ChatModelChoice => {
  const choice =
    choiceFor({ provider: PREFERRED_CHAT_PROVIDER, hidden }) ??
    choiceFor({ provider: PREFERRED_CHAT_PROVIDER });
  if (choice === null) {
    throw new Error(`no chat model line for ${PREFERRED_CHAT_PROVIDER}`);
  }
  return choice;
};

export const defaultChatModel = ({
  connected,
  workspaceDefaultProvider = null,
  hidden = null,
}: Params): ChatModelChoice => {
  if (workspaceDefaultProvider !== null && connected.includes(workspaceDefaultProvider)) {
    const workspaceChoice = choiceFor({ provider: workspaceDefaultProvider, hidden });
    if (workspaceChoice !== null) {
      return workspaceChoice;
    }
  }
  const allowed = connected.filter(
    (candidate) => choiceFor({ provider: candidate, hidden }) !== null,
  );
  const provider = allowed.includes(PREFERRED_CHAT_PROVIDER)
    ? PREFERRED_CHAT_PROVIDER
    : allowed.find((candidate) => isChatProvider(candidate));
  if (provider === undefined) {
    return preferredChoice({ hidden });
  }
  return choiceFor({ provider, hidden }) ?? preferredChoice({ hidden });
};
