import { useEffect, useRef } from 'react';
import { useAppStore } from '../../../../../store';
import { useNowSessions } from '../../../../../shared/hooks/useNowSessions';
import { useCallQuietStore } from '../../../../notifications/away/callQuietStore';
import { beforeCallRowsOf } from '../../beforeCallRowsOf';
import { callChipCommands } from '../../callChipCommands';
import { useCallChipStore } from '../../callChipStore';
import type { ChipCall } from '../../callChipTypes';
import { callChipViewOf } from '../../callChipViewOf';
import { reportChipError } from '../../reportChipError';

const FIRST_HEIGHT = 120;

type ShowFailedParams = {
  readonly call: ChipCall;
  readonly error: unknown;
};

type Params = {
  readonly onShowFailed: (params: ShowFailedParams) => void;
};

const hideChip = (): void => {
  callChipCommands
    .hide()
    .catch((error: unknown) => reportChipError({ title: "Couldn't hide the call chip", error }));
};

export const useCallChipView = ({ onShowFailed }: Params): void => {
  const { needsYou } = useNowSessions({});
  const chip = useCallChipStore((state) => state.state);
  const heldCount = useCallQuietStore((state) => state.held.length);
  const isShown = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (isShown.current) {
        isShown.current = false;
        hideChip();
      }
    };
  }, []);

  useEffect(() => {
    const waiting = beforeCallRowsOf({ state: useAppStore.getState(), sessions: needsYou });
    const view = callChipViewOf({ state: chip, waiting, heldCount });
    if (view === null) {
      if (!isShown.current) {
        return;
      }
      isShown.current = false;
      hideChip();
      return;
    }
    callChipCommands
      .show({ view, height: FIRST_HEIGHT })
      .then(() => {
        if (!isMounted.current) {
          hideChip();
          return;
        }
        isShown.current = true;
      })
      .catch((error: unknown) => {
        if (chip.kind === 'hidden') {
          return;
        }
        onShowFailed({ call: chip.call, error });
      });
  }, [chip, needsYou, heldCount, onShowFailed]);
};
