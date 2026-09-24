import type { ReactElement } from 'react';
import { CommandPalette } from '../../../features/session/components/CommandPalette';

type Props = {
  readonly studio: ReactElement | null;
  readonly paletteOpen: boolean;
  readonly palettePrefix: string;
  readonly closePalette: () => void;
};

export const AppScopeOverlays = ({ studio, paletteOpen, palettePrefix, closePalette }: Props) => (
  <>
    {studio !== null && (
      <div className="fixed inset-0 z-studio flex flex-col bg-background">{studio}</div>
    )}
    {paletteOpen && <CommandPalette initialQuery={palettePrefix} onClose={closePalette} />}
  </>
);
