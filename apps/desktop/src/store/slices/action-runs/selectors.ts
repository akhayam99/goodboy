import { useAppStore } from '../../store';
import { selectActionRun } from './selectActionRun';
import type { ActionRun } from './types';

type Params = {
  readonly key: string | null;
};

export const useActionRun = ({ key }: Params): ActionRun | null =>
  useAppStore((state) => selectActionRun({ state, key }));
