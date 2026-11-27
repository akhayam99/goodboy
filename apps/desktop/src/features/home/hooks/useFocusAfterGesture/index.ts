import { useCallback, useEffect, useState } from 'react';
import type { HomeWidgetId } from '../../grid/homeWidgets';

export type FocusTarget = HomeWidgetId | 'tray';

type FocusParams = {
  readonly target: FocusTarget;
};

type FocusAfterGesture = {
  readonly focusAfter: (params: FocusParams) => void;
};

const selectorOf = ({ target }: FocusParams): string =>
  target === 'tray' ? '[data-home-tray] button' : `[data-home-slot="${target}"] [data-widget-grip]`;

export const useFocusAfterGesture = (): FocusAfterGesture => {
  const [target, setTarget] = useState<FocusTarget | null>(null);
  const focusAfter = useCallback(({ target: next }: FocusParams): void => setTarget(next), []);
  useEffect(() => {
    if (target === null) {
      return;
    }
    const element = document.querySelector<HTMLElement>(selectorOf({ target }));
    const fallback = document.querySelector<HTMLElement>(selectorOf({ target: 'tray' }));
    (element ?? fallback)?.focus();
    setTarget(null);
  }, [target]);
  return { focusAfter };
};
