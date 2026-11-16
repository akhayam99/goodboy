import type { ProviderId } from '@goodboy/types';
import type { IntegrationGlyphProvider } from '../../shared/components/IntegrationGlyph';
import type { ConnectionsFocus } from './connectionsFocus';

type Params = {
  readonly provider?: ProviderId;
  readonly tool?: IntegrationGlyphProvider;
};

export const connectionFocusOf = ({ provider, tool }: Params): ConnectionsFocus | null => {
  if (provider !== undefined) {
    return { kind: 'provider', provider };
  }
  if (tool !== undefined) {
    return { kind: 'tool', tool };
  }
  return null;
};
