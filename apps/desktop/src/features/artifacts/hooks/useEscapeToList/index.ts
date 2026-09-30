import { useEscapeLayer } from '@goodboy/ui';
import { isTextEntryTarget } from '../../../../shared/keyboard/isTypingTarget';

type Params = {
  readonly isActive: boolean;
  readonly onEscape: () => void;
};

export const useEscapeToList = ({ isActive, onEscape }: Params): void => {
  useEscapeLayer(() => {
    if (isTextEntryTarget(document.activeElement)) {
      return;
    }
    onEscape();
  }, isActive);
};
