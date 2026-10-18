import type { IntegrationGlyphProvider } from '../../../features/integrations/components/IntegrationGlyph';
import type { StudioPlace } from '../../../store';

export const isAppScopeOverlay = ({ overlay }: { readonly overlay: StudioPlace }): boolean => {
  switch (overlay.kind) {
    case 'settings':
    case 'guide':
      return true;
    case 'addWorkspace':
    case 'workflow':
    case 'inbox':
    case 'impact':
    case 'changelog':
    case 'notifications':
    case 'chat':
    case 'terminal':
    case 'monitoring':
      return false;
    default: {
      const unreachable: never = overlay;
      return unreachable;
    }
  }
};

type FooterPlace = 'link' | 'inbox' | 'workflows' | 'settings' | 'impact' | 'changelog';

export type FooterTarget = {
  readonly place: FooterPlace | null;
  readonly tool: IntegrationGlyphProvider | null;
};
