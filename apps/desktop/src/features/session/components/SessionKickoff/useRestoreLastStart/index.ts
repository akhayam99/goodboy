import { useEffect } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { selectSessionDraft } from '../../../../../store/slices/sessionDraft/selectSessionDraft';
import { lastStartKey, parseLastStart, startPickOf } from '../../../startKind/lastStartSetting';
import { START_KIND_COPY } from '../../../startKind/startKindCopy';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export const useRestoreLastStart = ({ workspaceId }: Params): void => {
  const hasChosenStart = useAppStore(
    (state) => selectSessionDraft({ state, workspaceId }).hasChosenStart,
  );

  useEffect(() => {
    if (hasChosenStart) {
      return;
    }
    let isCurrent = true;
    const { loadSetting, reportError } = useAppStore.getState();
    loadSetting(lastStartKey({ workspaceId }))
      .then((raw) => {
        const last = parseLastStart({ raw });
        const state = useAppStore.getState();
        if (
          !isCurrent ||
          last === null ||
          selectSessionDraft({ state, workspaceId }).hasChosenStart
        ) {
          return;
        }
        state.patchSessionDraft({
          workspaceId,
          patch: { ...startPickOf({ last }), hasChosenStart: true },
        });
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          void reportError({ title: START_KIND_COPY.lastStartFailed, error, workspaceId });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [hasChosenStart, workspaceId]);
};
