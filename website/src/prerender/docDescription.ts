import { clipText } from './clipText';
import type { FeatureDoc } from './FEATURE_DOCS';

type Params = {
  readonly doc: FeatureDoc;
};

const SHORT_INTRO = 110;

export const docDescription = ({ doc }: Params) => {
  const topics = doc.headings.slice(0, 4).join(', ');
  if (doc.intro === '') {
    return clipText(`${doc.title} in Goodboy: ${topics} and more.`);
  }
  return clipText(
    doc.intro.length < SHORT_INTRO && topics !== '' ? `${doc.intro} Covers ${topics}.` : doc.intro,
  );
};
