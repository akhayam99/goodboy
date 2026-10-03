import { PROVIDER_CAPABILITIES, getModelProvider, clampEffortForModel } from '@goodboy/core';
import type { AgentEffort, ProviderId, Session } from '@goodboy/types';
import type { AgentKind, AgentKindRouting } from './agent-kind';

type SpawnRoutingOrigin = 'chat' | 'role-default';

export type SpawnRouting = AgentKindRouting & {
  readonly origin: SpawnRoutingOrigin;
};

type Params = {
  readonly kind: AgentKind;
  readonly roleDefault: AgentKindRouting;
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
  const requested = session.effort ?? fallbackEffort;
  return {
    provider,
    model,
    effort: clampEffortForModel({ model, effort: requested, provider }) ?? requested,
  };
};

export const resolveSpawnRouting = ({ kind, roleDefault, session }: Params): SpawnRouting => {
  const origin: SpawnRoutingOrigin = 'role-default';
  if (kind !== 'generic' || session == null) {
    return { ...roleDefault, origin };
  }
  const fromChat = chatRouting({ session, fallbackEffort: roleDefault.effort });
  if (fromChat == null) {
    return { ...roleDefault, origin };
  }
  return { ...fromChat, origin: 'chat' };
};
