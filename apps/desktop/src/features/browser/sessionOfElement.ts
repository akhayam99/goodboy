import { brandId, type SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { BROWSER_SESSION_ATTRIBUTE } from './browserSessionAttribute';

type Params = {
  readonly element: Element;
};

export const sessionOfElement = ({ element }: Params): SessionId | null => {
  const value =
    element.closest(`[${BROWSER_SESSION_ATTRIBUTE}]`)?.getAttribute(BROWSER_SESSION_ATTRIBUTE) ??
    '';
  return value === '' ? useAppStore.getState().currentSessionId : brandId<SessionId>({ value });
};
