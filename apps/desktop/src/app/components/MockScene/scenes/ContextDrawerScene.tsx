import type { ContextDrawerSection } from '../../../../store/slices/drawer/state';
import { ActivityRunScene } from './ActivityRunScene';

const contextSectionFromUrl = (): ContextDrawerSection => {
  const section =
    new URLSearchParams(window.location.search).get('section') ??
    new URLSearchParams(window.location.search).get('tab');
  return section === 'goal' || section === 'summary' || section === 'explanations'
    ? section
    : 'decisions';
};

export const ContextDrawerScene = () => (
  <ActivityRunScene contextSection={contextSectionFromUrl()} />
);
