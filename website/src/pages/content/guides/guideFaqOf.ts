import { SITE } from '../../../lib/site';
import { ADE_GUIDE } from '../adeGuide';
import type { GuideFaq } from '../Guide';
import { GUIDES } from './GUIDES';

type Params = {
  readonly path: string;
};

export const guideFaqOf = ({ path }: Params): GuideFaq | undefined => {
  if (path === SITE.ade) {
    return ADE_GUIDE.faq;
  }
  return GUIDES.find((guide) => guide.path === path)?.faq;
};
