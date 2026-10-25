import { create } from 'zustand';
import { STORAGE_KEYS } from './storage-keys';

const MORE_QUERY = '(prefers-contrast: more)';
const ATTRIBUTE = 'data-contrast';
const MORE = 'more';
const STANDARD = 'standard';

const readSwitch = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEYS.contrast) === MORE;
  } catch {
    return false;
  }
};

type SwitchParams = {
  readonly isOn: boolean;
};

const writeSwitch = ({ isOn }: SwitchParams): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.contrast, isOn ? MORE : STANDARD);
  } catch {
    return;
  }
};

const moreQuery = (): MediaQueryList | null =>
  typeof window.matchMedia === 'function' ? window.matchMedia(MORE_QUERY) : null;

type ApplyParams = {
  readonly isMore: boolean;
};

const applyDocumentContrast = ({ isMore }: ApplyParams): void => {
  const root = document.documentElement;
  if (isMore) {
    root.setAttribute(ATTRIBUTE, MORE);
    return;
  }
  root.removeAttribute(ATTRIBUTE);
};

type ContrastState = {
  readonly isSwitchOn: boolean;
};

export const useContrastStore = create<ContrastState>(() => ({ isSwitchOn: false }));

const applyCurrent = (): void => {
  applyDocumentContrast({
    isMore: useContrastStore.getState().isSwitchOn || moreQuery()?.matches === true,
  });
};

export const switchContrast = ({ isOn }: SwitchParams): void => {
  writeSwitch({ isOn });
  useContrastStore.setState({ isSwitchOn: isOn });
  applyCurrent();
};

type StorageParams = Pick<StorageEvent, 'key' | 'newValue'>;

const onStorage = ({ key, newValue }: StorageParams): void => {
  if (key !== STORAGE_KEYS.contrast) {
    return;
  }
  useContrastStore.setState({ isSwitchOn: newValue === MORE });
  applyCurrent();
};

export const bootstrapContrast = (): (() => void) => {
  useContrastStore.setState({ isSwitchOn: readSwitch() });
  applyCurrent();
  const query = moreQuery();
  window.addEventListener('storage', onStorage);
  query?.addEventListener('change', applyCurrent);
  return () => {
    window.removeEventListener('storage', onStorage);
    query?.removeEventListener('change', applyCurrent);
  };
};
