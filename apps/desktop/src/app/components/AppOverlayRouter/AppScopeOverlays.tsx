import type { ReactElement } from 'react';
import { PaletteOverlay } from '../../../features/palette/components/PaletteOverlay';
import type { PaletteRequest } from '../../../features/palette/paletteModeTypes';

type Props = {
  readonly studio: ReactElement | null;
  readonly palette: PaletteRequest | null;
  readonly closePalette: () => void;
};

export const AppScopeOverlays = ({ studio, palette, closePalette }: Props) => (
  <>
    {studio !== null && (
      <div className="fixed inset-0 z-studio flex flex-col bg-background">{studio}</div>
    )}
    {palette !== null && (
      <PaletteOverlay mode={palette.mode} initialQuery={palette.query} onClose={closePalette} />
    )}
  </>
);
