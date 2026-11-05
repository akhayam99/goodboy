import type { FeatureDoc } from './FEATURE_DOCS';
import { SEARCH_HINTS } from './SEARCH_HINTS';

type Params = {
  readonly doc: FeatureDoc;
};

export const docTitle = ({ doc }: Params) => {
  const hint = SEARCH_HINTS[doc.area];
  return hint === undefined ? `${doc.title} | Goodboy docs` : `${doc.title}: ${hint}`;
};
