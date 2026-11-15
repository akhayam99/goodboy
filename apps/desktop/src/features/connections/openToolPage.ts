import type { IntegrationGlyphProvider } from '../../shared/components/IntegrationGlyph';
import { useAppStore } from '../../store';

type Params = {
  readonly tool: IntegrationGlyphProvider;
};

export const openToolPage = ({ tool }: Params): void => {
  useAppStore
    .getState()
    .openStudio({ studio: { kind: 'connections', focus: { kind: 'tool', tool } } });
};
