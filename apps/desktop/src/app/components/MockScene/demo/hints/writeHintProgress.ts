import { HINT_PROGRESS_KEY } from './hintProgressKey';
import type { HintProgress } from './hintProgressTypes';

type Params = {
  readonly progress: HintProgress;
};

export const writeHintProgress = ({ progress }: Params): void => {
  try {
    window.sessionStorage.setItem(HINT_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    return;
  }
};
