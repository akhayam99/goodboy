import { useCallback, type KeyboardEvent } from 'react';

type Params = {
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onReplay: () => void;
  readonly onHideHint: () => void;
  readonly onShowHint: () => void;
};

export const useDemoKeys = ({ onPrevious, onNext, onReplay, onHideHint, onShowHint }: Params) =>
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
      if (event.key === 'Escape') {
        onHideHint();
        return;
      }
      if (event.key === 'h' || event.key === 'H') {
        event.preventDefault();
        onShowHint();
        return;
      }
      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        onReplay();
      }
    },
    [onPrevious, onNext, onReplay, onHideHint, onShowHint],
  );
