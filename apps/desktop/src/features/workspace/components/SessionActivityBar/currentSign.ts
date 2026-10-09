import type { LensKind } from '../../../../store';
import type { Page } from '../../../session/pageRegistry';

export type CurrentSign = Page['id'] | 'session' | 'remembered';

type Params = {
  readonly activeLens: LensKind | null;
  readonly pages: ReadonlyArray<Page>;
  readonly hasStudioOver: boolean;
};

export const currentSignOf = ({ activeLens, pages, hasStudioOver }: Params): CurrentSign => {
  if (hasStudioOver) {
    return 'remembered';
  }
  const match = pages.find((page) => page.currentLenses.includes(activeLens));
  return match === undefined ? 'session' : match.id;
};
