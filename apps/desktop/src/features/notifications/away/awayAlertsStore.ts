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
  readonly setBadge: (params: BadgeParams) => boolean;
  readonly setBannerChoice: (params: BannerParams) => boolean;
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

const writeStored = ({ key, value }: WriteParams): boolean => {
  try {
    localStorage.setItem(key, value);
  } catch {
    return false;
  }
  return true;
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
    if (!writeStored({ key: STORAGE_KEYS.awayBadge, value: isOn ? BADGE_ON : BADGE_OFF })) {
      return false;
    }
    set({ isBadgeOn: isOn });
    return true;
  },
  setBannerChoice: ({ choice }) => {
    if (!writeStored({ key: STORAGE_KEYS.awayBanner, value: choice })) {
      return false;
    }
    set({ bannerChoice: choice });
    return true;
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('storage', ({ key }) => {
    if (key === STORAGE_KEYS.awayBadge || key === STORAGE_KEYS.awayBanner) {
      useAwayAlertsStore.setState({ isBadgeOn: readBadge(), bannerChoice: readChoice() });
    }
  });
}
