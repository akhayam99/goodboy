import type { ReactElement } from 'react';
import type { PaletteRequest } from '../../../features/palette/paletteModeTypes';
import { FindInViewController } from '../../../features/search/findInView/FindInViewController';
import { SessionSwitcher } from '../../../features/workspace/components/SessionSwitcher';
import { LazyPaletteOverlay } from './LazyPaletteOverlay';

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
      <LazyPaletteOverlay mode={palette.mode} initialQuery={palette.query} onClose={closePalette} />
    )}
    <FindInViewController />
    <SessionSwitcher />
  </>
);
