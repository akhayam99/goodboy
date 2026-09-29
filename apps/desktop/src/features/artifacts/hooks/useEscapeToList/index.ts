import { useEscapeLayer } from '@goodboy/ui';

type Params = {
  readonly isActive: boolean;
  readonly onEscape: () => void;
};

const isTextEntry = (target: Element | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

export const useEscapeToList = ({ isActive, onEscape }: Params): void => {
  useEscapeLayer(() => {
    if (isTextEntry(document.activeElement)) {
      return;
    }
    onEscape();
  }, isActive);
};
