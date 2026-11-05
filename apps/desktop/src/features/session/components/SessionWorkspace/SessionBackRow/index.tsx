import type { SessionId } from '@goodboy/types';
import { Button, ICON_SIZE } from '@goodboy/ui';
import { ChevronLeft } from 'lucide-react';
import { useAppStore } from '../../../../../store';
import type { AppState } from '../../../../../store/types';
import { backOf, type Back } from '../../../../../store/slices/navigation/backOf';
import { captureLocation } from '../../../../../store/slices/navigation/captureLocation';

type Props = {
  readonly sessionId: SessionId;
};

type BackParams = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

const backIn = ({ state, sessionId }: BackParams): Back | null => {
  const { place } = captureLocation({ state });
  if (place.at !== 'session' || place.sessionId !== sessionId) {
    return null;
  }
  return backOf({ state, place });
};

export const SessionBackRow = ({ sessionId }: Props) => {
  const label = useAppStore((state) => backIn({ state, sessionId })?.label ?? null);
  if (label === null) {
    return null;
  }
  const goBack = () => {
    const back = backIn({ state: useAppStore.getState(), sessionId });
    if (back === null) {
      return;
    }
    useAppStore.getState().upTo({ to: back.to });
  };
  return (
    <div data-session-back="" className="flex min-w-0 items-center">
      <Button variant="quiet" size="xs" className="pl-0" onClick={goBack} aria-label={label}>
        <ChevronLeft size={ICON_SIZE.row} aria-hidden />
        {label}
      </Button>
    </div>
  );
};
