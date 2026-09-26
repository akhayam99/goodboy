import {
  PROVIDER_IDS,
  type PlanId,
  type ProviderId,
  type ProviderLifecycleAction,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import type { ImpactScope } from '../../../features/impact/lib';
import {
  INBOX_KINDS,
  INBOX_PROVIDERS,
  type InboxKind,
  type InboxProvider,
} from '../../../features/inbox/types';
import type { SettingsStudioScope } from '../../../features/settings/components/SettingsStudio/types';
import type { StudioPlace } from '../../../store';

type EventValueParams = {
  readonly event: Event;
  readonly key: string;
};

export const eventValue = ({ event, key }: EventValueParams): unknown => {
  if (!(event instanceof CustomEvent)) {
    return undefined;
  }
  const detail: unknown = event.detail;
  if (typeof detail !== 'object' || detail === null) {
    return undefined;
  }
  return Reflect.get(detail, key);
};

const isSessionId = (value: unknown): value is SessionId => typeof value === 'string';

export const isPlanId = (value: unknown): value is PlanId => typeof value === 'string';

export const isWorkspaceId = (value: unknown): value is WorkspaceId => typeof value === 'string';

const isProviderId = (value: unknown): value is ProviderId =>
  typeof value === 'string' && PROVIDER_IDS.some((providerId) => providerId === value);

const isProviderLifecycleAction = (value: unknown): value is ProviderLifecycleAction =>
  value === 'install' || value === 'login' || value === 'logout' || value === 'update';

const isInboxProvider = (value: unknown): value is InboxProvider =>
  typeof value === 'string' && INBOX_PROVIDERS.some((provider) => provider === value);

const isInboxKind = (value: unknown): value is InboxKind =>
  typeof value === 'string' && INBOX_KINDS.some((kind) => kind === value);

const isSettingsScope = (value: unknown): value is SettingsStudioScope =>
  value === 'app' || value === 'workspace' || value === 'providers' || value === 'tools';

const isImpactScope = (value: unknown): value is ImpactScope => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const kind: unknown = Reflect.get(value, 'kind');
  if (kind === 'overview' || kind === 'shipped' || kind === 'flow' || kind === 'efficiency') {
    return true;
  }
  if (kind === 'provider') {
    return typeof Reflect.get(value, 'provider') === 'string';
  }
  if (kind === 'session') {
    return isSessionId(Reflect.get(value, 'sessionId'));
  }
  return false;
};

export const eventSessionId = (event: Event): SessionId | null => {
  const sessionId = eventValue({ event, key: 'sessionId' });
  return isSessionId(sessionId) && sessionId !== '' ? sessionId : null;
};

export const settingsOverlayFromEvent = (event: Event): StudioPlace => {
  const scope = eventValue({ event, key: 'scope' });
  const tool = eventValue({ event, key: 'tool' });
  const section = eventValue({ event, key: 'section' });
  const provider =
    eventValue({ event, key: 'provider' }) ?? eventValue({ event, key: 'providerId' });
  const action = eventValue({ event, key: 'action' });
  return {
    kind: 'settings',
    focus: {
      scope: isSettingsScope(scope) ? scope : 'app',
      tool: isInboxProvider(tool) ? tool : undefined,
      section: typeof section === 'string' ? section : undefined,
      provider: isProviderId(provider) ? provider : undefined,
      action: isProviderLifecycleAction(action) ? action : undefined,
    },
  };
};

export const inboxOverlayFromEvent = (event: Event): StudioPlace => {
  const provider = eventValue({ event, key: 'provider' });
  const kind = eventValue({ event, key: 'kind' });
  const recordKey = eventValue({ event, key: 'recordKey' });
  return {
    kind: 'inbox',
    focus: {
      provider: isInboxProvider(provider) ? provider : null,
      kind: isInboxKind(kind) ? kind : null,
      recordKey: typeof recordKey === 'string' ? recordKey : null,
      sessionId: eventSessionId(event),
    },
  };
};

export const impactOverlayFromEvent = (event: Event): StudioPlace => {
  const scope = eventValue({ event, key: 'scope' });
  return { kind: 'impact', scope: isImpactScope(scope) ? scope : null };
};
