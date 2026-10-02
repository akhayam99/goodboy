import type { IntegrationGlyphProvider } from '../../../features/integrations/components/IntegrationGlyph';
import type { SettingsFocus } from '../../../features/settings/settingsFocus';
import type { InboxStudioFocus, StudioPlace } from '../../../store';

export const isAppScopeOverlay = ({ overlay }: { readonly overlay: StudioPlace }): boolean => {
  switch (overlay.kind) {
    case 'settings':
    case 'guide':
    case 'companion':
      return true;
    case 'addWorkspace':
    case 'workflow':
    case 'inbox':
    case 'impact':
    case 'changelog':
    case 'notifications':
    case 'chat':
      return false;
    default: {
      const unreachable: never = overlay;
      return unreachable;
    }
  }
};

export type ConnectedIntegrations = Readonly<Record<IntegrationGlyphProvider, boolean>>;

type FooterPlace = 'link' | 'inbox' | 'workflows' | 'settings' | 'impact' | 'changelog';

export type FooterTarget = {
  readonly place: FooterPlace | null;
  readonly tool: IntegrationGlyphProvider | null;
};

const NO_FOOTER_TARGET: FooterTarget = { place: null, tool: null };

const placeTarget = ({ place }: { readonly place: FooterPlace }): FooterTarget => ({
  place,
  tool: null,
});

type FooterTargetParams = {
  readonly overlay: StudioPlace | null;
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
  if (focus.scope === 'tools' && focus.tool !== undefined && !connected[focus.tool]) {
    return placeTarget({ place: 'link' });
  }
  return placeTarget({ place: 'settings' });
};

const inboxTarget = ({ focus, connected }: InboxTargetParams): FooterTarget => {
  const provider = focus?.provider ?? null;
  return { place: 'inbox', tool: provider !== null && connected[provider] ? provider : null };
};

export const footerTarget = ({ overlay, connected }: FooterTargetParams): FooterTarget => {
  if (overlay === null) {
    return NO_FOOTER_TARGET;
  }
  switch (overlay.kind) {
    case 'settings':
      return settingsTarget({ focus: overlay.focus, connected });
    case 'inbox':
      return inboxTarget({ focus: overlay.focus, connected });
    case 'workflow':
      return placeTarget({ place: 'workflows' });
    case 'impact':
      return placeTarget({ place: 'impact' });
    case 'changelog':
      return placeTarget({ place: 'changelog' });
    case 'guide':
    case 'companion':
    case 'addWorkspace':
    case 'notifications':
    case 'chat':
      return NO_FOOTER_TARGET;
    default: {
      const unreachable: never = overlay;
      return unreachable;
    }
  }
};
