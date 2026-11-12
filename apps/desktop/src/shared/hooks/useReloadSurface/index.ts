import { useEffect, useId, useRef, type RefObject } from 'react';
import { reloadSurfaces } from '../../keyboard/reload/reloadSurfaces';

type Params = {
  readonly isEnabled: boolean;
  readonly isMain: boolean;
  readonly hasNativeView: boolean;
  readonly root?: RefObject<Element | null>;
  readonly reload: () => void;
};

export const useReloadSurface = ({
  isEnabled,
  isMain,
  hasNativeView,
  root,
  reload,
}: Params): void => {
  const key = useId();
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    return reloadSurfaces.register({
      key,
      surface: {
        isMain,
        hasNativeView,
        root: () => root?.current ?? null,
        reload: () => reloadRef.current(),
      },
    });
  }, [key, isEnabled, isMain, hasNativeView, root]);
};
