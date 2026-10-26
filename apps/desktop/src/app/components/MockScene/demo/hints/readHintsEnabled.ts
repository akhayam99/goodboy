import { HINTS_OFF_KEY } from './hintsOffKey';

type Params = {
  readonly isFallbackOn: boolean;
};

export const readHintsEnabled = ({ isFallbackOn }: Params): boolean => {
  try {
    return window.sessionStorage.getItem(HINTS_OFF_KEY) !== 'true';
  } catch {
    return isFallbackOn;
  }
};
