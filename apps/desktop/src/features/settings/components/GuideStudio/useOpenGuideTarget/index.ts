import { useCallback } from 'react';
import { useAppStore } from '../../../../../store';
import { BOARD_PLACE } from '../../../../../store/slices/navigation/place';
import { OPEN_COMMAND_PALETTE_EVENT } from '../../../../onboarding/openCommandPaletteEvent';
import { requestNewSession } from '../../../../session/requestNewSession';
import type { GuideTarget } from '../guideTarget';

export const useOpenGuideTarget = (): ((target: GuideTarget) => void) => {
  const openStudio = useAppStore((state) => state.openStudio);
  const closeStudio = useAppStore((state) => state.closeStudio);
  const navigate = useAppStore((state) => state.navigate);

  return useCallback(
    (target: GuideTarget) => {
      switch (target.kind) {
        case 'studio':
          openStudio({ studio: target.studio });
          return;
        case 'board':
          closeStudio();
          if (useAppStore.getState().currentSessionId !== null) {
            navigate({ to: BOARD_PLACE });
          }
          return;
        case 'newSession':
          requestNewSession();
          return;
        case 'palette':
          closeStudio();
          window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
          return;
        default: {
          const unreachable: never = target;
          return unreachable;
        }
      }
    },
    [closeStudio, navigate, openStudio],
  );
};
