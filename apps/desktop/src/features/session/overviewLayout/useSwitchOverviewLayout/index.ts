import { useCallback } from 'react';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';
import { undoable } from '../../../../shared/utils/undoable';
import { useAppStore } from '../../../../store';
import { SETTING_OVERVIEW_LAYOUT } from '../../../settings/settings';
import { applyOverviewLayout } from '../applyOverviewLayout';
import { overviewLayoutOf, type OverviewLayout } from '../overviewLayoutOf';

type SwitchParams = {
  readonly layout: OverviewLayout;
  readonly hasUndo?: boolean;
};

type Switch = {
  readonly switchTo: (params: SwitchParams) => Promise<boolean>;
  readonly isPending: boolean;
};

const PENDING_KEY = 'overview-layout';

const CLASSIC_TOAST = 'Back on the classic overview.';

export const useSwitchOverviewLayout = (): Switch => {
  const { run, pendingKeys } = usePendingAction();

  const switchTo = useCallback(
    async ({ layout, hasUndo = false }: SwitchParams): Promise<boolean> => {
      let isChanged = false;
      const isSaved = await run({
        key: PENDING_KEY,
        failureTitle: "Couldn't save the overview setting",
        task: async () => {
          await useAppStore.getState().loadSetting(SETTING_OVERVIEW_LAYOUT);
          const current = overviewLayoutOf({
            raw: useAppStore.getState().settings[SETTING_OVERVIEW_LAYOUT],
          });
          if (current === layout) {
            return;
          }
          isChanged = true;
          await applyOverviewLayout({ layout });
        },
      });
      if (isSaved && isChanged && hasUndo && layout === 'classic') {
        undoable({
          message: CLASSIC_TOAST,
          undo: () => applyOverviewLayout({ layout: 'new' }),
        });
      }
      return isSaved;
    },
    [run],
  );

  return { switchTo, isPending: pendingKeys.has(PENDING_KEY) };
};
