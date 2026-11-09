import {
  LEFT_SIDEBAR_DEFAULT,
  LEFT_SIDEBAR_MAX,
  LEFT_SIDEBAR_MIN,
  useResizableWidth,
} from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';
import { SESSION_TOOL_RAIL_WIDTH } from '../../../../features/session/components/SessionTools/sessionToolRailWidth';
import { useShellFolds } from '../../../hooks/useShellFolds';
import { useSessionRailFold, type SessionRailFold } from '../useSessionRailFold';

export const SESSION_RAIL_WIDTH_VAR = '--goodboy-session-rail-width';

export type SessionRailSizing = {
  readonly resizable: ReturnType<typeof useResizableWidth<HTMLElement>>;
  readonly fold: SessionRailFold;
};

export const useSessionRailSizing = (): SessionRailSizing => {
  const resizable = useResizableWidth<HTMLElement>({
    storageKey: STORAGE_KEYS.sessionRailWidth,
    defaultWidth: LEFT_SIDEBAR_DEFAULT,
    min: LEFT_SIDEBAR_MIN,
    max: LEFT_SIDEBAR_MAX,
    cssVar: SESSION_RAIL_WIDTH_VAR,
  });
  const isDrawerOpen = useAppStore((state) => state.drawer !== null);
  const isBrowserOpen = useAppStore((state) => state.drawer?.kind === 'browser');
  const folds = useShellFolds({ railWidth: resizable.width, toolsWidth: SESSION_TOOL_RAIL_WIDTH });
  const fold = useSessionRailFold({
    isNarrow: folds.isRailNarrow || isBrowserOpen,
    isDrawerOpen,
  });
  return { resizable, fold };
};
