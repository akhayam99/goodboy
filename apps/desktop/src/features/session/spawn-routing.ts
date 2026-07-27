import { PROVIDER_CAPABILITIES, getModelProvider } from '@goodboy/core';
import type { AgentEffort, ProviderId, RoleModelPreferences, Session } from '@goodboy/types';
import { clampEffort } from '../chat/utils/chat-constants';
import { isRightSizedKind, kindRouting, type AgentKind, type AgentKindRouting } from './agent-kind';

export type SpawnRoutingOrigin = 'chat' | 'right-sized' | 'role-default';

export type SpawnRouting = AgentKindRouting & {
  readonly origin: SpawnRoutingOrigin;
};

type Params = {
  readonly kind: AgentKind;
  readonly roleModels: RoleModelPreferences | null;
  readonly session: Session | null;
};

type ChatParams = {
  readonly session: Session;
  readonly fallbackEffort: AgentEffort;
};

const PROVIDER_IDS: ReadonlyArray<ProviderId> = Object.keys(PROVIDER_CAPABILITIES).filter(
  (id): id is ProviderId => id in PROVIDER_CAPABILITIES,
);

const chatRouting = ({ session, fallbackEffort }: ChatParams): AgentKindRouting | null => {
  const model = session.modelOverride;
  if (model == null || model === '') {
    return null;
  }
  const pinned = PROVIDER_IDS.find((id) => id === session.providerOverride) ?? null;
  const provider = pinned ?? getModelProvider(model);
  if (provider == null) {
    return null;
  }
  return { provider, model, effort: clampEffort(model, session.effort ?? fallbackEffort) };
};

export const resolveSpawnRouting = ({ kind, roleModels, session }: Params): SpawnRouting => {
  const roleDefault = kindRouting({ kind, roleModels });
  const origin: SpawnRoutingOrigin = isRightSizedKind({ kind, roleModels })
    ? 'right-sized'
    : 'role-default';
  if (kind !== 'generic' || session == null) {
    return { ...roleDefault, origin };
  }
  const fromChat = chatRouting({ session, fallbackEffort: roleDefault.effort });
  if (fromChat == null) {
    return { ...roleDefault, origin };
  }
  return { ...fromChat, origin: 'chat' };
};
