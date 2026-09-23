import type { SessionId } from '@goodboy/types';
import type { ImpactScope } from '../../../features/impact/lib';
import type { InboxKind, InboxProvider } from '../../../features/inbox/types';
import type { IntegrationGlyphProvider } from '../../../features/integrations/components/IntegrationGlyph';
import type { SettingsFocus } from '../../../features/settings/components/SettingsStudio/types';
import type { MoreStudioId } from '../../components/AppFooter/moreStudios';

export type InboxStudioFocus = {
  readonly provider: InboxProvider | null;
  readonly kind: InboxKind | null;
  readonly recordKey: string | null;
  readonly sessionId: SessionId | null;
};

export type Overlay =
  | { readonly kind: 'settings'; readonly focus: SettingsFocus }
  | { readonly kind: 'guide' }
  | { readonly kind: 'report' }
  | { readonly kind: 'companion' }
  | { readonly kind: 'addWorkspace' }
  | { readonly kind: 'workflow' }
  | { readonly kind: 'inbox'; readonly focus: InboxStudioFocus | null }
  | { readonly kind: 'impact'; readonly scope: ImpactScope | null }
  | { readonly kind: 'changelog' }
  | { readonly kind: 'notifications' };

export const isAppScopeOverlay = ({ overlay }: { readonly overlay: Overlay }): boolean => {
  switch (overlay.kind) {
    case 'settings':
    case 'guide':
    case 'report':
    case 'companion':
      return true;
    case 'addWorkspace':
    case 'workflow':
    case 'inbox':
    case 'impact':
    case 'changelog':
    case 'notifications':
      return false;
    default: {
      const unreachable: never = overlay;
      return unreachable;
    }
  }
};

export type ConnectedIntegrations = Readonly<Record<IntegrationGlyphProvider, boolean>>;

export type FooterTarget =
  | IntegrationGlyphProvider
  | 'link'
  | 'inbox'
  | 'workflows'
  | 'providers'
  | 'settings'
  | MoreStudioId
  | null;

type FooterTargetParams = {
  readonly overlay: Overlay | null;
  readonly connected: ConnectedIntegrations;
};

type SettingsTargetParams = {
  readonly focus: SettingsFocus;
  readonly connected: ConnectedIntegrations;
};

type InboxTargetParams = {
  readonly focus: InboxStudioFocus | null;
  readonly connected: ConnectedIntegrations;
};

const settingsTarget = ({ focus, connected }: SettingsTargetParams): FooterTarget => {
  if (focus.scope === 'providers') {
    return 'providers';
  }
  if (focus.scope === 'tools' && focus.tool !== undefined && !connected[focus.tool]) {
    return 'link';
  }
  return 'settings';
};

const inboxTarget = ({ focus, connected }: InboxTargetParams): FooterTarget => {
  const provider = focus?.provider ?? null;
  if (provider !== null && connected[provider]) {
    return provider;
  }
  return 'inbox';
};

export const footerTarget = ({ overlay, connected }: FooterTargetParams): FooterTarget => {
  if (overlay === null) {
    return null;
  }
  switch (overlay.kind) {
    case 'settings':
      return settingsTarget({ focus: overlay.focus, connected });
    case 'inbox':
      return inboxTarget({ focus: overlay.focus, connected });
    case 'workflow':
      return 'workflows';
    case 'impact':
      return 'impact';
    case 'changelog':
      return 'changelog';
    case 'guide':
    case 'report':
    case 'companion':
    case 'addWorkspace':
    case 'notifications':
      return null;
    default: {
      const unreachable: never = overlay;
      return unreachable;
    }
  }
};
