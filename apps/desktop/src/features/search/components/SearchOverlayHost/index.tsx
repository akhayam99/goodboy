import { useCallback } from 'react';
import { useAppStore } from '../../../../store';
import { OPEN_COMMAND_PALETTE_EVENT } from '../../../onboarding/openCommandPaletteEvent';
import { FindInViewController } from '../../findInView/FindInViewController';
import type { SwitchModeParams } from '../../overlayMode';
import { SearchOverlay } from '../SearchOverlay';

export const SearchOverlayHost = () => {
  const overlay = useAppStore((state) => state.searchOverlay);
  const close = useAppStore((state) => state.closeSearchOverlay);
  const switchToCommands = useCallback(
    ({ text }: SwitchModeParams) => {
      close();
      window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT, { detail: { text } }));
    },
    [close],
  );
  return (
    <>
      <FindInViewController />
      {overlay === null ? null : (
        <SearchOverlay initialText={overlay.text} onSwitchMode={switchToCommands} onClose={close} />
      )}
    </>
  );
};
