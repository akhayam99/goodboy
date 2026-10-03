import { useEffect, useMemo } from 'react';
import type { ProjectId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { parseScriptPins } from '../../parseScriptPins';
import { scriptPinsKey } from '../../scriptPinsKey';

type Params = {
  readonly projectIds: ReadonlyArray<ProjectId>;
};

type ScriptPins = Readonly<Record<ProjectId, ReadonlyArray<string>>>;

export const useScriptPins = ({ projectIds }: Params): ScriptPins => {
  const settings = useAppStore((state) => state.settings);
  const loadScriptPins = useAppStore((state) => state.loadScriptPins);
  const projectKey = projectIds.join('|');

  useEffect(() => {
    void loadScriptPins().catch(() => undefined);
  }, [loadScriptPins]);

  return useMemo(() => {
    const ids = projectKey === '' ? [] : (projectKey.split('|') as ProjectId[]);
    return Object.fromEntries(
      ids.map((projectId) => [
        projectId,
        parseScriptPins({ raw: settings[scriptPinsKey({ projectId })] }),
      ]),
    );
  }, [projectKey, settings]);
};
