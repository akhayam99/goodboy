import type { ContextDrawerTab } from '../../../../store/slices/drawer/state';
import { ActivityRunScene } from './ActivityRunScene';

const contextTabFromUrl = (): ContextDrawerTab => {
  const tab = new URLSearchParams(window.location.search).get('tab');
  return tab === 'goal' || tab === 'summary' ? tab : 'decisions';
};

export const ContextDrawerScene = () => <ActivityRunScene contextTab={contextTabFromUrl()} />;
