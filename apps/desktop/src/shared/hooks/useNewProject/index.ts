import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../../store';
import { homeFolder } from '../../lib/homeFolder';
import { usePickFolder } from '../usePickFolder';
import { SETTING_NEW_PROJECT_PARENT } from '../../../features/settings/settings';
import { joinPath, projectNameProblem } from '../../lib/projectName';

export type NewProjectModel = {
  readonly home: string | null;
  readonly name: string;
  readonly setName: (name: string) => void;
  readonly parent: string | null;
  readonly changeParent: () => Promise<void>;
  readonly folderPath: string | null;
  readonly nameProblem: string | null;
  readonly isUsable: boolean;
};

export const useNewProject = (): NewProjectModel => {
  const savedParent = useAppStore((state) => state.settings[SETTING_NEW_PROJECT_PARENT] ?? null);
  const pickFolder = usePickFolder();
  const [name, setName] = useState('');
  const [chosenParent, setChosenParent] = useState<string | null>(null);
  const [home, setHome] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    void homeFolder().then((found) => {
      if (!isCancelled) {
        setHome(found);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, []);

  const parent = chosenParent ?? savedParent ?? home;
  const trimmed = name.trim();
  const nameProblem = projectNameProblem(name);
  const isUsable = parent !== null && trimmed !== '' && nameProblem === null;
  const folderPath = parent === null || trimmed === '' ? null : joinPath({ parent, name: trimmed });

  const changeParent = useCallback(async () => {
    const picked = await pickFolder();
    if (picked !== null) {
      setChosenParent(picked);
    }
  }, [pickFolder]);

  return { home, name, setName, parent, changeParent, folderPath, nameProblem, isUsable };
};
