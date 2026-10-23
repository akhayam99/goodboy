import { useCallback, type KeyboardEvent } from 'react';

type Params = {
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onToggle: () => void;
  readonly onReplay: () => void;
};

type TargetParams = {
  readonly target: EventTarget;
};

const isControl = ({ target }: TargetParams): boolean =>
  target instanceof HTMLElement && target.closest('button, a, input, textarea') !== null;

export const useDemoKeys = ({ onPrevious, onNext, onToggle, onReplay }: Params) =>
  useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onPrevious();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onNext();
        return;
      }
      if (event.key === ' ' && !isControl({ target: event.target })) {
        event.preventDefault();
        onToggle();
        return;
      }
      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        onReplay();
      }
    },
    [onPrevious, onNext, onToggle, onReplay],
  );
