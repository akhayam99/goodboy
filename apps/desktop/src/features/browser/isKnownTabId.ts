import type { AppState } from '../../store/types';

type Params = {
  readonly state: AppState;
  readonly tabId: string;
};

export const isKnownTabId = ({ state, tabId }: Params): boolean =>
  Object.values(state.browserSessionTabs).some((tabs) => tabs.some((tab) => tab.id === tabId)) ||
  Object.values(state.browserProjectPins).some((pins) => pins.some((pin) => pin.id === tabId));
