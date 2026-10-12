import { sectionOf } from './sectionOf';

type Params = {
  readonly text: string;
};

export const findingOf = ({ text }: Params): string => {
  const finding = sectionOf({ text, heading: 'Finding' });
  if (finding !== null && finding.body.length > 0) {
    return finding.body;
  }
  return sectionOf({ text, heading: 'Proposed fix' })?.before ?? text;
};
