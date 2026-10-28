import { HINTS_OFF_KEY } from './hintsOffKey';

type Params = {
  readonly isEnabled: boolean;
};

export const writeHintsEnabled = ({ isEnabled }: Params): void => {
  try {
    if (isEnabled) {
      window.sessionStorage.removeItem(HINTS_OFF_KEY);
      return;
    }
    window.sessionStorage.setItem(HINTS_OFF_KEY, 'true');
  } catch {
    return;
  }
};
