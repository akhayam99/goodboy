import { useEffect, useState } from 'react';
import {
  DRAWER_INSET,
  LEFT_SIDEBAR_DEFAULT,
  LEFT_SIDEBAR_MAX,
  LEFT_SIDEBAR_MIN,
  LEFT_SIDEBAR_STORAGE_KEY,
  READER_DRAWER_DEFAULT,
  RIGHT_DRAWER_DEFAULT,
  readStoredWidth,
} from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { selectDrawerPanel } from '../../../store/slices/drawer/selectDrawerPanel';
import { selectDrawerSizing } from '../../../store/slices/drawer/selectDrawerSizing';
import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';
import { shellFoldsOf, type ShellFolds } from '../../shellArrangement/shellFoldsOf';

const widthOf = (node: Element): number | null => {
  const width = node.getBoundingClientRect().width;
  return width > 0 ? width : null;
};

const useWindowWidth = (): number | null => {
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const root = document.documentElement;
    const observer = new ResizeObserver(() => setWidth(widthOf(root)));
    observer.observe(root);
    setWidth(widthOf(root));
    return () => observer.disconnect();
  }, []);
  return width;
};

export const useShellFolds = (): ShellFolds => {
  const windowWidth = useWindowWidth();
  const paneWidth = useAppStore((state) => {
    if (selectDrawerPanel(state) === null) {
      return 0;
    }
    const drawer =
      selectDrawerSizing(state) === 'reader' ? READER_DRAWER_DEFAULT : RIGHT_DRAWER_DEFAULT;
    return drawer + DRAWER_INSET * 2;
  });
  const mainWidth = readStoredWidth({
    storageKey: LEFT_SIDEBAR_STORAGE_KEY,
    fallback: LEFT_SIDEBAR_DEFAULT,
    min: LEFT_SIDEBAR_MIN,
    max: LEFT_SIDEBAR_MAX,
  });
  const railWidth = readStoredWidth({
    storageKey: STORAGE_KEYS.sessionRailWidth,
    fallback: LEFT_SIDEBAR_DEFAULT,
    min: LEFT_SIDEBAR_MIN,
    max: LEFT_SIDEBAR_MAX,
  });
  return shellFoldsOf({ windowWidth, mainWidth, railWidth, paneWidth });
};
