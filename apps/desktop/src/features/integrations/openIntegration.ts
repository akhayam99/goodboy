import type { IntegrationGlyphProvider } from '../../shared/components/IntegrationGlyph';
import { openConnection } from '../connections/openConnection';

type Params = {
  readonly tool?: IntegrationGlyphProvider;
};

export const openIntegration = ({ tool }: Params): void => {
  openConnection({ focus: tool === undefined ? null : { kind: 'tool', tool } });
};
