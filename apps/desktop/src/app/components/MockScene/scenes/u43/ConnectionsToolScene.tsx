import { useCallback } from 'react';
import type { IntegrationGlyphProvider } from '../../../../../shared/components/IntegrationGlyph';
import { BoardShellScene } from '../BoardShellScene';
import { ThemedScene } from '../u37/ThemedScene';
import { seedConnectionsTool } from './connectionsToolSeed';

type Props = {
  readonly tool: IntegrationGlyphProvider;
  readonly theme: 'dark' | 'light';
};

export const ConnectionsToolScene = ({ tool, theme }: Props) => {
  const afterSeed = useCallback(() => seedConnectionsTool({ tool }), [tool]);
  return (
    <ThemedScene theme={theme}>
      <BoardShellScene afterSeed={afterSeed} />
    </ThemedScene>
  );
};
