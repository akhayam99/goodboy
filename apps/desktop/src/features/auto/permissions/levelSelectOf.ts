import type { AutoLevel } from '@goodboy/core/auto';
import { RUN_AUTONOMY_OPTIONS } from '../../workflows/runAutonomy';

type PickParams = {
  readonly level: AutoLevel;
};

type Params = {
  readonly onPick: (params: PickParams) => void;
};

export const levelSelectOf =
  ({ onPick }: Params) =>
  (choice: string): void => {
    const level = RUN_AUTONOMY_OPTIONS.find((option) => option.key === choice)?.key;
    if (level !== undefined) {
      onPick({ level });
    }
  };
