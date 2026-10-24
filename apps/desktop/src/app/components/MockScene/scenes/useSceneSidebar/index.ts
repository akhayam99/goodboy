import { useCallback, useState } from 'react';
import { isDirectedScene } from '../../demo/director/isDirectedScene';

type Params = {
  readonly isCollapsed: boolean;
};

type SceneSidebar = {
  readonly isCollapsed: boolean;
  readonly toggle: () => void;
};

export const useSceneSidebar = ({ isCollapsed }: Params): SceneSidebar => {
  const [isFolded, setIsFolded] = useState(isCollapsed);
  const toggle = useCallback(() => {
    if (!isDirectedScene()) {
      return;
    }
    setIsFolded((current) => !current);
  }, []);
  return { isCollapsed: isFolded, toggle };
};
