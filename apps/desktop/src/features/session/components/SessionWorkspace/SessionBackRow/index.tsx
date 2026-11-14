import type { SessionId } from '@goodboy/types';
import { Button, ICON_SIZE } from '@goodboy/ui';
import { ChevronLeft } from 'lucide-react';
import { useAppStore } from '../../../../../store';
import { sessionBackOf } from './sessionBackOf';

type Props = {
  readonly sessionId: SessionId;
};

export const SessionBackRow = ({ sessionId }: Props) => {
  const label = useAppStore((state) => sessionBackOf({ state, sessionId })?.label ?? null);
  if (label === null) {
    return null;
  }
  const goBack = () => {
    const back = sessionBackOf({ state: useAppStore.getState(), sessionId });
    if (back === null) {
      return;
    }
    useAppStore.getState().upTo({ to: back.to });
  };
  return (
    <div data-session-back="" className="flex min-w-0 items-center">
      <Button
        variant="quiet"
        size="xs"
        className="max-w-full pl-0"
        onClick={goBack}
        aria-label={label}
      >
        <ChevronLeft size={ICON_SIZE.row} aria-hidden />
        <span className="truncate">{label}</span>
      </Button>
    </div>
  );
};
