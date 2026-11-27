import { create } from 'zustand';
import { STORAGE_KEYS } from '../../shared/lib/storage-keys';

type ShowParams = {
  readonly isShown: boolean;
};

type State = {
  readonly isShown: boolean;
  readonly setShown: (params: ShowParams) => void;
};

const HIDDEN = 'false';

const readShown = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEYS.iphoneBarIcon) !== HIDDEN;
  } catch {
    return true;
  }
};

const writeShown = ({ isShown }: ShowParams): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.iphoneBarIcon, isShown ? 'true' : HIDDEN);
  } catch {
    return;
  }
};

export const useIphoneBarIconStore = create<State>((set) => ({
  isShown: readShown(),
  setShown: ({ isShown }) => {
    writeShown({ isShown });
    set({ isShown });
  },
}));
