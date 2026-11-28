import { useCallback, useEffect } from 'react';
import { PREFERRED_LANGUAGES, parsePreferredLanguage } from '@goodboy/core/language';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { READ_FAILED } from '../../../../store/slices/notifications/errorRecovery';
import { PREFERRED_LANGUAGE_KEY } from '../../../../store/slices/settings/preferredLanguageKey';
import { settingRowKey } from '../../settingRowKey';
import { useSettingSave, type SettingSave } from '../useSettingSave';

export const AUTO_LANGUAGE = 'auto';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type ValueParams = {
  readonly value: string;
};

const displayOf = ({ value }: ValueParams): string =>
  PREFERRED_LANGUAGES.find((language) => language.code === value)?.nativeName ?? 'Auto';

export const usePreferredLanguage = ({ workspaceId }: Params): SettingSave<string> => {
  const raw = useAppStore((state) => state.workspaceValues[workspaceId]?.[PREFERRED_LANGUAGE_KEY]);
  const loadWorkspaceValue = useAppStore((state) => state.loadWorkspaceValue);
  const saveWorkspaceValue = useAppStore((state) => state.saveWorkspaceValue);
  const reportError = useAppStore((state) => state.reportError);

  useEffect(() => {
    loadWorkspaceValue({ workspaceId, key: PREFERRED_LANGUAGE_KEY }).catch((failure: unknown) => {
      void reportError({
        recovery: READ_FAILED,
        title: "Couldn't read the preferred language",
        error: failure,
        severity: 'warning',
        workspaceId,
      });
    });
  }, [workspaceId, loadWorkspaceValue, reportError]);

  const write = useCallback(
    ({ value }: ValueParams) =>
      saveWorkspaceValue({
        workspaceId,
        key: PREFERRED_LANGUAGE_KEY,
        value: value === AUTO_LANGUAGE ? null : value,
      }),
    [saveWorkspaceValue, workspaceId],
  );

  return useSettingSave({
    rowKey: settingRowKey({ workspaceId, row: 'preferred-language' }),
    saved: parsePreferredLanguage({ raw }) ?? AUTO_LANGUAGE,
    write,
    display: displayOf,
    failureTitle: "Couldn't save the preferred language",
    workspaceId,
  });
};
