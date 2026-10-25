import { create } from 'zustand';
import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';

export type BannerChoice = 'unasked' | 'on' | 'off';

type BadgeParams = {
  readonly isOn: boolean;
};

type BannerParams = {
  readonly choice: BannerChoice;
};

type AwayAlertsState = {
  readonly isBadgeOn: boolean;
  readonly bannerChoice: BannerChoice;
  readonly setBadge: (params: BadgeParams) => void;
  readonly setBannerChoice: (params: BannerParams) => void;
};

type KeyParams = {
  readonly key: string;
};

type WriteParams = KeyParams & {
  readonly value: string;
};

type ValueParams = {
  readonly value: string | null;
};

const BADGE_ON = '1';
const BADGE_OFF = '0';

const readStored = ({ key }: KeyParams): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStored = ({ key, value }: WriteParams): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
};

const badgeOf = ({ value }: ValueParams): boolean => value !== BADGE_OFF;

const choiceOf = ({ value }: ValueParams): BannerChoice =>
  value === 'on' || value === 'off' ? value : 'unasked';

const readBadge = (): boolean => badgeOf({ value: readStored({ key: STORAGE_KEYS.awayBadge }) });

const readChoice = (): BannerChoice =>
  choiceOf({ value: readStored({ key: STORAGE_KEYS.awayBanner }) });

export const useAwayAlertsStore = create<AwayAlertsState>((set) => ({
  isBadgeOn: readBadge(),
  bannerChoice: readChoice(),
  setBadge: ({ isOn }) => {
    writeStored({ key: STORAGE_KEYS.awayBadge, value: isOn ? BADGE_ON : BADGE_OFF });
    set({ isBadgeOn: isOn });
  },
  setBannerChoice: ({ choice }) => {
    writeStored({ key: STORAGE_KEYS.awayBanner, value: choice });
    set({ bannerChoice: choice });
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('storage', ({ key }) => {
    if (key === STORAGE_KEYS.awayBadge || key === STORAGE_KEYS.awayBanner) {
      useAwayAlertsStore.setState({ isBadgeOn: readBadge(), bannerChoice: readChoice() });
    }
  });
}
