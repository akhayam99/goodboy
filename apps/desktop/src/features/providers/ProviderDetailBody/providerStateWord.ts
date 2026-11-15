import type { LimitsChipState } from '@goodboy/core/providers';
import type { StateTone } from '@goodboy/ui';
import type { ProviderRailStatus } from '../providerRailStatus';
import type { ProviderDisplayInfo } from '../providers';

export type ProviderStateWord = {
  readonly word: string;
  readonly tone: StateTone;
};

type Params = {
  readonly info: ProviderDisplayInfo;
  readonly isApi: boolean;
  readonly isReady: boolean;
  readonly rail: ProviderRailStatus;
  readonly limitState: LimitsChipState;
};

const NOT_SET_UP: ProviderStateWord = { word: 'Not set up', tone: 'neutral' };

const stateToneOf = ({ tone }: Pick<ProviderRailStatus, 'tone'>): StateTone => {
  if (tone === 'warning' || tone === 'danger' || tone === 'info' || tone === 'success') {
    return tone;
  }
  return 'neutral';
};

export const providerStateWord = ({
  info,
  isApi,
  isReady,
  rail,
  limitState,
}: Params): ProviderStateWord => {
  if (!isReady && (info.connection === 'missing' || info.connection === 'unknown')) {
    return NOT_SET_UP;
  }
  if (rail.subtitle !== undefined) {
    return { word: rail.subtitle, tone: stateToneOf({ tone: rail.tone }) };
  }
  if (limitState === 'out') {
    return { word: 'Out of usage', tone: 'warning' };
  }
  if (limitState === 'warning') {
    return { word: 'About to run out', tone: 'warning' };
  }
  if (isApi) {
    return { word: 'Key saved', tone: 'neutral' };
  }
  return { word: 'Ready', tone: 'success' };
};
