import { appScrollIntoView } from '@goodboy/ui';

type Params = {
  readonly scroller: HTMLElement | null;
  readonly section: string;
};

export const revealContextSection = ({ scroller, section }: Params): void => {
  const target = scroller?.querySelector(`[data-context-section="${section}"]`);
  appScrollIntoView({ element: target, block: 'start' });
};
