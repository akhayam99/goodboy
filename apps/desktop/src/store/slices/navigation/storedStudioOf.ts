import type { ProviderId } from '@goodboy/types';
import type { IntegrationGlyphProvider } from '../../../shared/components/IntegrationGlyph';
import type { StudioPlace } from './studio';

type FormerSettingsFocus =
  | { readonly scope: 'tools'; readonly tool?: IntegrationGlyphProvider }
  | { readonly scope: 'providers'; readonly provider: ProviderId };

export type StoredStudio =
  StudioPlace | { readonly kind: 'settings'; readonly focus: FormerSettingsFocus };

type Params = {
  readonly studio: StudioPlace | null;
};

export const storedStudioOf = ({ studio }: Params): StoredStudio | null => {
  if (studio?.kind !== 'connections') {
    return studio;
  }
  const focus = studio.focus ?? null;
  if (focus === null) {
    return { kind: 'settings', focus: { scope: 'tools' } };
  }
  if (focus.kind === 'tool') {
    return { kind: 'settings', focus: { scope: 'tools', tool: focus.tool } };
  }
  return { kind: 'settings', focus: { scope: 'providers', provider: focus.provider } };
};
