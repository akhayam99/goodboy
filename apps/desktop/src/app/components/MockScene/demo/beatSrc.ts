import type { DemoBeat } from './demoChapters';

type Params = {
  readonly beat: DemoBeat;
  readonly theme: 'dark' | 'light';
};

export const beatSrc = ({ beat, theme }: Params): string => {
  const query = new URLSearchParams({ scene: beat.scene, ...beat.params, theme });
  return `${window.location.pathname}?${query.toString()}`;
};
